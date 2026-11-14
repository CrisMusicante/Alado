/**
 * How the musicians' lyrics PDF sizes each song: a general setting (Configuración) that a song
 * may override field by field. Same shape as src/utils/sheetStyle.ts (processes can't share types).
 */

export type SheetSize = 'auto' | 'lg' | 'md' | 'sm'
export type SheetColumns = 'auto' | 1 | 2
export interface SheetStyle { size: SheetSize; columns: SheetColumns }
/** Per-song override; a missing field means "use the general setting". */
export type SongSheetStyle = Partial<SheetStyle>

export const DEFAULT_SHEET_STYLE: SheetStyle = { size: 'auto', columns: 'auto' }

const SIZES: readonly unknown[] = ['auto', 'lg', 'md', 'sm']
const COLUMNS: readonly unknown[] = ['auto', 1, 2]

/** Keeps only known values; accepts an object or its JSON text (as stored in the DB). */
export function parseSheetStyle(v: unknown): SongSheetStyle {
  if (typeof v === 'string') {
    try { v = JSON.parse(v) } catch { return {} }
  }
  if (typeof v !== 'object' || v === null) return {}
  const o = v as Record<string, unknown>
  return {
    ...(SIZES.includes(o.size) ? { size: o.size as SheetSize } : {}),
    ...(COLUMNS.includes(o.columns) ? { columns: o.columns as SheetColumns } : {})
  }
}

export function resolveSheetStyle(general: SheetStyle, song: SongSheetStyle | null | undefined): SheetStyle {
  return { size: song?.size ?? general.size, columns: song?.columns ?? general.columns }
}

/**
 * Picks font size (pt) and column count for one song, given `fits(pt, cols)` that says whether
 * it fits on one page. Auto size: the largest from 24 down to 14 pt, preferring one column unless
 * that drops below 16 pt and two columns allow bigger text. Nothing fits → minimum size and the
 * song continues on another page.
 *
 * Self-contained on purpose (no outer references): its source is injected into the PDF page.
 */
export function chooseLayout(style: SheetStyle, fits: (pt: number, cols: 1 | 2) => boolean): { pt: number; cols: 1 | 2 } {
  const FIXED: Record<string, number> = { lg: 20, md: 16, sm: 12 }
  const MAX = 24
  const MIN = 14
  const ONE_COL_MIN = 16
  const options: Array<1 | 2> = style.columns === 'auto' ? [1, 2] : [style.columns]

  if (style.size !== 'auto') {
    const pt = FIXED[style.size]
    for (const cols of options) if (fits(pt, cols)) return { pt, cols }
    return { pt, cols: options[options.length - 1] }
  }

  const best = (cols: 1 | 2): number | null => {
    for (let pt = MAX; pt >= MIN; pt--) if (fits(pt, cols)) return pt
    return null
  }
  if (options.length === 1) return { pt: best(options[0]) ?? MIN, cols: options[0] }
  const one = best(1)
  const two = best(2)
  if (one !== null && (one >= ONE_COL_MIN || two === null || one >= two)) return { pt: one, cols: 1 }
  if (two !== null) return { pt: two, cols: 2 }
  return { pt: MIN, cols: 2 }
}
