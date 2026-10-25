export const MEDIA_SCHEME = 'alado-media'

const VIDEO_EXT = /\.(mp4|m4v|webm|mov)$/i
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/

/**
 * Decodes `alado-media://video/<encoded absolute path>` into the file path, or null if the URL is
 * malformed or doesn't point at a video file. Only videos are served, so the scheme can't be used to
 * read the DB or other local files from the renderer.
 */
export function mediaPathFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.hostname !== 'video') return null
  let path: string
  try {
    path = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  } catch {
    return null
  }
  if (!ABSOLUTE.test(path) || !VIDEO_EXT.test(path) || path.includes('\0')) return null
  return path
}
