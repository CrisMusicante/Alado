import { Section } from '../store/songs.store'

interface HeaderMatch {
  type: Section['type']
  baseLabel: string
  num?: number
}

const HEADER_PATTERNS: Array<{ re: RegExp; type: Section['type']; baseLabel: string }> = [
  { re: /^(pre[-\s]?chorus|pre[-\s]?coro)\s*(\d*)/i, type: 'pre-chorus',  baseLabel: 'Pre-Coro' },
  { re: /^(verse|verso)\s*(\d*)/i,                    type: 'verse',       baseLabel: 'Verso' },
  { re: /^(chorus|coro)\s*(\d*)/i,                    type: 'chorus',      baseLabel: 'Coro' },
  { re: /^(estribillo|refrain)\s*(\d*)/i,             type: 'estribillo',  baseLabel: 'Estribillo' },
  { re: /^(bridge|puente)\s*(\d*)/i,                  type: 'bridge',      baseLabel: 'Puente' },
  { re: /^(intro)\s*(\d*)/i,                          type: 'intro',       baseLabel: 'Intro' },
  { re: /^(outro|final|coda|ending)\s*(\d*)/i,        type: 'outro',       baseLabel: 'Outro' },
  { re: /^(tag|hook|gancho|vamp)\s*(\d*)/i,           type: 'custom',      baseLabel: 'Tag' },
]

function matchHeader(line: string): HeaderMatch | null {
  const bracketed = /^\[.+\]$/.test(line.trim())
  const clean = line.replace(/^\[|\]$/g, '').replace(/:$/, '').trim()

  for (const { re, type, baseLabel } of HEADER_PATTERNS) {
    const m = clean.match(re)
    if (!m) continue
    if (m[0].length !== clean.length && !bracketed) continue
    return { type, baseLabel, num: m[2] ? Number(m[2]) : undefined }
  }
  return null
}

/** Normalize block content for repetition comparison (case-insensitive, whitespace-collapsed). */
function blockKey(lines: string[]): string {
  return lines.join('\n').toLowerCase().replace(/[^\w\náéíóúüñ\n]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Parses raw lyrics text into Section[].
 *
 * Detection strategy (in priority order):
 * 1. Explicit bracket headers → [Verse 1], [Coro], [Pre-Coro], [Estribillo], etc.
 * 2. Standalone keyword lines  → VERSO, CORO, ESTRIBILLO, PRE-CORO, PUENTE, etc.
 * 3. Repetition analysis       → identical blocks appearing 2+ times → Coro
 *                                unique blocks → Verso N
 */
export function parseLyricsToSections(raw: string): Section[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return []

  const rawBlocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)

  // ── Pass 1: split each block into optional header line + body lines ──────────
  type BlockInfo = {
    header: HeaderMatch | null
    lines: string[]          // body lines (header excluded if present)
    raw: string[]            // all lines including header
  }

  const parsed: BlockInfo[] = rawBlocks.map(block => {
    const all = block.split('\n').map(l => l.trim()).filter(Boolean)
    const header = all.length ? matchHeader(all[0]) : null
    return { header, lines: header ? all.slice(1) : all, raw: all }
  })

  // ── Pass 2: repetition analysis for headerless blocks ───────────────────────
  // Count how many times each unique content appears (across headerless blocks only)
  const contentCount = new Map<string, number>()
  for (const b of parsed) {
    if (!b.header) {
      const k = blockKey(b.lines)
      contentCount.set(k, (contentCount.get(k) ?? 0) + 1)
    }
  }

  // ── Pass 3: assign types and labels ─────────────────────────────────────────
  const typeCount: Partial<Record<Section['type'], number>> = {}
  // Track which repeated-content blocks we've already labelled (so all repetitions
  // of the same chorus share the label "Coro", not "Coro 1", "Coro 2"...)
  const seenRepeated = new Map<string, string>()  // key → assigned label

  const sections: Section[] = []

  for (const b of parsed) {
    if (!b.lines.length && !b.header) continue

    if (b.header) {
      // ── Explicitly labelled section ──────────────────────────────────────────
      const { type, baseLabel, num } = b.header
      typeCount[type] = (typeCount[type] ?? 0) + 1
      const count = typeCount[type]!
      const n = num ?? (count > 1 ? count : undefined)
      sections.push({
        type,
        label: n != null ? `${baseLabel} ${n}` : baseLabel,
        lines: b.lines,
      })
    } else {
      // ── Unlabelled block: use repetition to decide type ──────────────────────
      const k = blockKey(b.lines)
      const occurrences = contentCount.get(k) ?? 1
      const isRepeated = occurrences >= 2

      if (isRepeated) {
        if (seenRepeated.has(k)) {
          // Subsequent repetition — reuse same label
          sections.push({ type: 'chorus', label: seenRepeated.get(k)!, lines: b.lines })
        } else {
          // First occurrence of this repeated block
          typeCount['chorus'] = (typeCount['chorus'] ?? 0) + 1
          const count = typeCount['chorus']!
          const label = count > 1 ? `Coro ${count}` : 'Coro'
          seenRepeated.set(k, label)
          sections.push({ type: 'chorus', label, lines: b.lines })
        }
      } else {
        // Unique block → verse
        typeCount['verse'] = (typeCount['verse'] ?? 0) + 1
        sections.push({ type: 'verse', label: `Verso ${typeCount['verse']}`, lines: b.lines })
      }
    }
  }

  return sections
}
