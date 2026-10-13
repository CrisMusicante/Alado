// IPC arguments come from the renderer and end up in filesystem paths (including
// recursive deletes), so they are checked before any path is built.

export function assertSongId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Id de canción inválido: ${String(value)}`)
  }
  return value
}

export function assertStem(value: unknown): 'instrumental' | 'vocals' {
  if (value !== 'instrumental' && value !== 'vocals') {
    throw new Error(`Nombre de pista inválida: ${String(value)}`)
  }
  return value
}
