import { ipcMain } from 'electron'
import https from 'https'
import http from 'http'
import { load, CheerioAPI } from 'cheerio'

export interface LyricsFetchResult {
  success: boolean
  rawText?: string
  site?: string
  error?: string
}

// ── HTTP fetch ────────────────────────────────────────────────────────────────

function fetchHtml(url: string, redirectCount = 0): Promise<string> {
  if (redirectCount > 5) return Promise.reject(new Error('Demasiadas redirecciones'))

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      },
      (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location
          const redirectUrl = loc.startsWith('http') ? loc : new URL(loc, url).href
          res.resume()
          fetchHtml(redirectUrl, redirectCount + 1).then(resolve).catch(reject)
          return
        }
        if (res.statusCode && res.statusCode >= 400) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      },
    )
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('Timeout al conectar'))
    })
  })
}

// ── Site-specific extractors ──────────────────────────────────────────────────

function extractLetras($: CheerioAPI): string | null {
  // letras.com — <div class="cnt-letra">
  const container = $('.cnt-letra, .lyric-original, #letra-content').first()
  if (!container.length) return null
  container.find('br').replaceWith('\n')
  container.find('p').each((_, el) => { $(el).after('\n\n') })
  return container.text().trim() || null
}

function extractGenius($: CheerioAPI): string | null {
  // genius.com — multiple [data-lyrics-container] divs
  const containers = $('[data-lyrics-container="true"]')
  if (!containers.length) return null
  let text = ''
  containers.each((_, el) => {
    $(el).find('br').replaceWith('\n')
    $('[class*="InlineComment"]', el).remove()
    text += $(el).text().trim() + '\n\n'
  })
  return text.trim() || null
}

function extractMusica($: CheerioAPI): string | null {
  const container = $('#lyrics_espace, .lyrics-body, .song-text').first()
  if (!container.length) return null
  container.find('br').replaceWith('\n')
  return container.text().trim() || null
}

function extractGeneric($: CheerioAPI): string | null {
  // Remove noisy elements
  $('script, style, nav, header, footer, aside, [class*="ad-"], [id*="ad-"], [class*="banner"]').remove()

  // Walk common containers in priority order
  const selectors = [
    '[class*="lyric"]',
    '[class*="letra"]',
    '[id*="lyric"]',
    '[id*="letra"]',
    '[class*="song-text"]',
    'article',
    'main',
  ]

  for (const sel of selectors) {
    const el = $(sel).first()
    if (!el.length) continue
    el.find('br').replaceWith('\n')
    const text = el.text().trim()
    // Require at least 4 lines that look like lyrics
    const lines = text.split('\n').filter(l => l.trim().length > 2)
    if (lines.length >= 4) return text
  }
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectSite(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase()
    if (h.includes('letras.com')) return 'letras'
    if (h.includes('genius.com')) return 'genius'
    if (h.includes('musica.com')) return 'musica'
    return 'generic'
  } catch {
    return 'generic'
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    // Strip common non-lyric boilerplate lines
    .filter(line => !line.match(/^(Composer|Lyricist|Copyright|Writer|Contributor|℗|©|Embed|[0-9]+\s*Embed)/i))
    .join('\n')
    .trim()
}

// ── IPC handler registration ──────────────────────────────────────────────────

export function registerLyricsHandlers(): void {
  // Option 2 — URL scraping
  ipcMain.handle('lyrics:fetch-url', async (_e, url: string): Promise<LyricsFetchResult> => {
    // Validate
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return { success: false, error: 'URL inválida. Asegúrate de incluir https://' }
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, error: 'Solo se admiten URLs http:// o https://' }
    }

    try {
      const html = await fetchHtml(url)
      const $ = load(html)
      const site = detectSite(url)

      let rawText: string | null = null
      if (site === 'letras') rawText = extractLetras($)
      else if (site === 'genius') rawText = extractGenius($)
      else if (site === 'musica') rawText = extractMusica($)

      // Generic fallback if site extractor failed or unknown site
      if (!rawText) rawText = extractGeneric($)

      if (!rawText || rawText.length < 50) {
        return {
          success: false,
          error:
            'No se encontró letra en esta página. Intenta copiar la letra manualmente usando la pestaña "Pegar letra".',
        }
      }

      return { success: true, rawText: cleanText(rawText), site }
    } catch (err: any) {
      const msg: string = err?.message ?? 'Error desconocido'
      const friendly = msg.includes('Timeout')
        ? 'La página tardó demasiado. Verifica tu conexión.'
        : msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')
          ? 'No se pudo conectar. Verifica tu conexión a internet.'
          : `Error al acceder a la página: ${msg}`
      return { success: false, error: friendly }
    }
  })

  // Option 4 stub — Claude AI import (ready for future implementation)
  // To enable: get the API key from settings, fetch HTML, call Claude API,
  // return { success: true, rawText } with sections already labeled.
  ipcMain.handle('lyrics:fetch-ai', async (_e, _payload: unknown): Promise<LyricsFetchResult> => {
    return { success: false, error: 'AI_NOT_CONFIGURED' }
  })
}
