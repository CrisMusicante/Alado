/** Demucs reports progress with tqdm on stderr: " 45%|████ | 121/270 [...]". */
export function parseDemucsProgress(chunk: string): number | null {
  const matches = [...chunk.matchAll(/(\d{1,3})%\|/g)]
  if (matches.length === 0) return null
  return Math.min(100, Number(matches[matches.length - 1][1]))
}
