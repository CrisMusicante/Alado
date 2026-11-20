import type { SyncSection } from './types'

export interface DiffLine { kind: 'same' | 'added' | 'removed'; text: string }
export interface SectionDiff { label: string; lines: DiffLine[] }

/** Line diff (LCS) of two line lists. */
function diffLines(a: string[], b: string[]): DiffLine[] {
  const m = a.length, n = b.length
  const lcs = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) {
    lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  }
  const out: DiffLine[] = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ kind: 'removed', text: a[i++] })
    else out.push({ kind: 'added', text: b[j++] })
  }
  while (i < m) out.push({ kind: 'removed', text: a[i++] })
  while (j < n) out.push({ kind: 'added', text: b[j++] })
  return out
}

/**
 * What a proposal changes in the lyrics, section by section (matched by label, in the
 * proposed order; unmatched sections of `before` come first, entirely removed).
 */
export function diffSections(before: SyncSection[], after: SyncSection[]): SectionDiff[] {
  // Match each proposed section to the first unused one with the same label; every section of
  // `before` left unmatched (also a dropped duplicate "Coro") is shown as removed.
  const used = new Set<number>()
  const kept = after.map(s => {
    const idx = before.findIndex((b, k) => !used.has(k) && b.label === s.label)
    if (idx >= 0) used.add(idx)
    return { label: s.label, lines: diffLines(idx >= 0 ? before[idx].lines : [], s.lines) }
  })
  const removed = before.filter((_, k) => !used.has(k))
    .map(s => ({ label: s.label, lines: s.lines.map(text => ({ kind: 'removed' as const, text })) }))
  return [...removed, ...kept]
}
