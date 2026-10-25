import type { ImportSummary } from '../store/songs.store'

/** Lines shown after importing a .alado service; empty categories are left out. */
export function importSummaryText(s: ImportSummary): string {
  const lines: string[] = []
  if (s.reused > 0) {
    lines.push(s.reused === 1 ? '1 canción ya estaba en esta compu.' : `${s.reused} canciones ya estaban en esta compu.`)
  }
  if (s.created.length) lines.push(`Se crearon: ${s.created.join(', ')}`)
  if (s.differing.length) lines.push(`Con letra distinta (se usó la de esta compu): ${s.differing.join(', ')}`)
  if (s.missingVideo.length) lines.push(`Sin video (fondo por defecto): ${s.missingVideo.join(', ')}`)
  if (s.missingAudio.length) lines.push(`Sin audio en esta compu: ${s.missingAudio.join(', ')}`)
  return lines.join('\n')
}
