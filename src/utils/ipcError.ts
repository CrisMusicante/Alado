/** User-facing message of an error thrown by a main-process handler (drops ipcRenderer's prefix). */
export function ipcErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, '')
}
