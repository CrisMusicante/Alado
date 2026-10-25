// Must match MEDIA_SCHEME in electron/media/mediaUrl.ts (processes can't share runtime code).
const MEDIA_SCHEME = 'alado-media'

/** URL the main window can use in <video src> for a local video file (served by the main process). */
export function mediaUrl(path: string): string {
  return `${MEDIA_SCHEME}://video/${encodeURIComponent(path)}`
}
