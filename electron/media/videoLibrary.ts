import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface VideoEntry {
  name: string
  path: string
  size: number
}

const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov'])

/** Background videos in `dir` (mp4/webm/mov), sorted by name; [] if the folder is missing. */
export function listVideos(dir: string): VideoEntry[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && VIDEO_EXT.has(path.extname(e.name).toLowerCase()))
    .map(e => {
      const p = path.join(dir, e.name)
      return { name: e.name, path: p, size: fs.statSync(p).size }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(file)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

async function sameContent(a: string, b: string): Promise<boolean> {
  if (fs.statSync(a).size !== fs.statSync(b).size) return false
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)])
  return ha === hb
}

/**
 * Copies `srcPath` into `dir` so songs reference it by a stable name. An identical file
 * already there (same name or an earlier "name (n)" copy) is reused; a different file
 * with the same name gets the next free "name (n).ext", never overwriting another song's video.
 */
export async function importVideo(srcPath: string, dir: string): Promise<VideoEntry> {
  fs.mkdirSync(dir, { recursive: true })
  const ext = path.extname(srcPath)
  const base = path.basename(srcPath, ext)
  const entry = (p: string): VideoEntry => ({ name: path.basename(p), path: p, size: fs.statSync(p).size })

  if (path.resolve(path.dirname(srcPath)) === path.resolve(dir)) return entry(srcPath)

  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? `${base}${ext}` : `${base} (${n})${ext}`)
    if (!fs.existsSync(candidate)) {
      // Async so a large copy from a USB stick never freezes the app (or the projection).
      try {
        await fs.promises.copyFile(srcPath, candidate)
      } catch (e) {
        fs.rmSync(candidate, { force: true })
        throw e
      }
      return entry(candidate)
    }
    if (await sameContent(srcPath, candidate)) return entry(candidate)
  }
}
