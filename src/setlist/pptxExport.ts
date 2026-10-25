import type { Song } from '../store/songs.store'
import { mediaUrl } from '../utils/mediaUrl'

/**
 * Emergency-backup PowerPoint of a service: a title slide per song, then one slide per section,
 * white centered text with shadow over a single still frame grabbed from the song's video
 * (darkened, light JPEG). No video or a frame we can't read → plain dark background.
 */

export type SlideSpec =
  | { kind: 'title'; songIndex: number; title: string; artist?: string }
  | { kind: 'section'; songIndex: number; text: string; repeat: number }

export function buildDeckPlan(songs: Song[]): SlideSpec[] {
  return songs.flatMap((song, songIndex): SlideSpec[] => [
    { kind: 'title', songIndex, title: song.title, ...(song.artist ? { artist: song.artist } : {}) },
    ...song.sections.map((s): SlideSpec => ({ kind: 'section', songIndex, text: s.lines.join('\n'), repeat: s.repeat ?? 1 }))
  ])
}

const MAX_PT = 40
const MIN_PT = 20
const BOX_W_PT = 12.3 * 72 // text box width on a 13.33in-wide 16:9 slide
const BOX_H_PT = 6.3 * 72
const CHAR_W = 0.55 // average glyph width relative to font size
const LINE_H = 1.25

/** Font size (pt) that fits the lines in the slide's text box, between 20 and 40. */
export function fitFontSize(text: string): number {
  const lines = text.split('\n')
  const longest = Math.max(1, ...lines.map(l => l.length))
  const byHeight = BOX_H_PT / (LINE_H * lines.length)
  const byWidth = BOX_W_PT / (CHAR_W * longest)
  return Math.round(Math.max(MIN_PT, Math.min(MAX_PT, byHeight, byWidth)))
}

const FRAME_MAX_W = 1280
const FRAME_MAX_H = 720
const FRAME_TIMEOUT_MS = 8000
const DARKEN = 'rgba(0,0,0,0.35)'

/** A darkened still from ~1s into the video, as a JPEG data URL; null if it can't be read. */
export function grabVideoFrame(videoPath: string): Promise<string | null> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    let done = false
    const finish = (value: string | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), FRAME_TIMEOUT_MS)

    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.onerror = () => finish(null)
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = Math.min(1, d * 0.1)
    }
    video.onseeked = () => {
      try {
        const scale = Math.min(1, FRAME_MAX_W / video.videoWidth, FRAME_MAX_H / video.videoHeight)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.fillStyle = DARKEN
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.7))
      } catch (e) {
        console.warn('No se pudo leer un cuadro del video', videoPath, e)
        finish(null)
      }
    }
    video.src = mediaUrl(videoPath)
  })
}

const PLAIN_BG = '0F172A'
const SHADOW = { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.8 } as const

export async function exportServicePptx(name: string, songs: Song[]): Promise<{ path: string } | null> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = name

  const frames = await Promise.all(songs.map(s => (s.video_path ? grabVideoFrame(s.video_path) : Promise.resolve(null))))

  for (const spec of buildDeckPlan(songs)) {
    const slide = pptx.addSlide()
    const frame = frames[spec.songIndex]
    // path only names the media file: without it pptxgenjs labels the JPEG as .png.
    slide.background = frame ? { data: frame.replace(/^data:/, ''), path: 'frame.jpg' } : { color: PLAIN_BG }

    if (spec.kind === 'title') {
      slide.addText(spec.title, {
        x: 0.5, y: spec.artist ? 2.4 : 2.9, w: 12.33, h: 1.6, align: 'center', valign: 'middle',
        fontSize: 48, bold: true, color: 'FFFFFF', shadow: SHADOW, fit: 'shrink'
      })
      if (spec.artist) {
        slide.addText(spec.artist, { x: 0.5, y: 4.0, w: 12.33, h: 0.8, align: 'center', fontSize: 24, color: 'CBD5E1', shadow: SHADOW })
      }
    } else {
      slide.addText(spec.text, {
        x: 0.5, y: 0.6, w: 12.33, h: 6.3, align: 'center', valign: 'middle',
        fontSize: fitFontSize(spec.text), bold: true, color: 'FFFFFF', shadow: SHADOW, fit: 'shrink'
      })
      if (spec.repeat > 1) {
        slide.addText(`×${spec.repeat}`, { x: 11.3, y: 6.8, w: 1.8, h: 0.5, align: 'right', fontSize: 18, color: 'CBD5E1' })
      }
    }
  }

  const bytes = await pptx.write({ outputType: 'uint8array' }) as Uint8Array
  return window.api.setlistSavePptx({ bytes, defaultName: name })
}
