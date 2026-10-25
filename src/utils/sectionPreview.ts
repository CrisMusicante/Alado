import type { Section, Song } from '../store/songs.store'

/** "Coro", or "Coro ×2" when the section repeats. */
export function sectionLabel(s: Section): string {
  return s.repeat && s.repeat > 1 ? `${s.label} ×${s.repeat}` : s.label
}

/** The opening of a song's lyrics, for the hover card in the Servicio library. */
export function previewSections(song: Song, maxSections = 2, maxLines = 2): Array<{ label: string; lines: string[]; truncated: boolean }> {
  return song.sections.slice(0, maxSections).map(s => ({
    label: sectionLabel(s),
    lines: s.lines.slice(0, maxLines),
    truncated: s.lines.length > maxLines
  }))
}
