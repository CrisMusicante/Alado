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

function sha256(file: string): string {
  const hash = crypto.createHash('sha256')
  const fd = fs.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(1 << 20)
    let n: number
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n))
  } finally {
    fs.closeSync(fd)
  }
  return hash.digest('hex')
}

function sameContent(a: string, b: string): boolean {
  return fs.statSync(a).size === fs.statSync(b).size && sha256(a) === sha256(b)
}

/**
 * Copies `srcPath` into `dir` so songs reference it by a stable name. An identical file
 * already there (same name or an earlier "name (n)" copy) is reused; a different file
 * with the same name gets the next free "name (n).ext", never overwriting another song's video.
 */
export function importVideo(srcPath: string, dir: string): VideoEntry {
  fs.mkdirSync(dir, { recursive: true })
  const ext = path.extname(srcPath)
  const base = path.basename(srcPath, ext)
  const entry = (p: string): VideoEntry => ({ name: path.basename(p), path: p, size: fs.statSync(p).size })

  if (path.resolve(path.dirname(srcPath)) === path.resolve(dir)) return entry(srcPath)

  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? `${base}${ext}` : `${base} (${n})${ext}`)
    if (!fs.existsSync(candidate)) {
      fs.copyFileSync(srcPath, candidate)
      return entry(candidate)
    }
    if (sameContent(srcPath, candidate)) return entry(candidate)
  }
}
