import { describe, it, expect } from 'vitest'
import { mediaPathFromUrl, MEDIA_SCHEME } from './mediaUrl'
import { mediaUrl } from '../../src/utils/mediaUrl'

describe('media URLs', () => {
  const win = 'C:\\Users\\Cris.py\\AppData\\Roaming\\alado\\videos\\Fondo 01.mp4'

  it('round-trips an absolute Windows path with spaces and accents', () => {
    const p = 'C:\\Users\\José\\Videos\\Altísimo #1.mp4'
    expect(mediaUrl(p).startsWith(`${MEDIA_SCHEME}://`)).toBe(true)
    expect(mediaPathFromUrl(mediaUrl(p))).toBe(p)
    expect(mediaPathFromUrl(mediaUrl(win))).toBe(win)
  })

  it('round-trips an absolute POSIX path', () => {
    expect(mediaPathFromUrl(mediaUrl('/Users/ana/Movies/fondo.mov'))).toBe('/Users/ana/Movies/fondo.mov')
  })

  it('accepts only video files', () => {
    expect(mediaPathFromUrl(mediaUrl('C:\\Windows\\win.ini'))).toBeNull()
    expect(mediaPathFromUrl(mediaUrl('C:\\Users\\x\\AppData\\Roaming\\alado\\worshipflow.db'))).toBeNull()
    expect(mediaPathFromUrl(mediaUrl('C:\\v\\clip.WEBM'))).toBe('C:\\v\\clip.WEBM')
  })

  it('rejects relative paths, other hosts and malformed URLs', () => {
    expect(mediaPathFromUrl(mediaUrl('videos\\fondo.mp4'))).toBeNull()
    expect(mediaPathFromUrl(`${MEDIA_SCHEME}://other/${encodeURIComponent('C:\\a.mp4')}`)).toBeNull()
    expect(mediaPathFromUrl(`${MEDIA_SCHEME}://video/%E0%A4%A`)).toBeNull()
    expect(mediaPathFromUrl('file:///C:/a.mp4')).toBeNull()
  })
})
