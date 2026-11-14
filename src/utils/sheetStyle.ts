/**
 * Musicians' lyrics PDF layout. Same shape as electron/setlist/sheetStyle.ts (processes can't share
 * types). The general setting lives in localStorage like the rest of Configuración, so each
 * computer keeps its own; a song may override it field by field (songs.sheet_style).
 */

export type SheetSize = 'auto' | 'lg' | 'md' | 'sm'
export type SheetColumns = 'auto' | 1 | 2
export interface SheetStyle { size: SheetSize; columns: SheetColumns }
export type SongSheetStyle = Partial<SheetStyle>

export const DEFAULT_SHEET_STYLE: SheetStyle = { size: 'auto', columns: 'auto' }

export const SIZE_OPTIONS: Array<{ value: SheetSize; label: string; hint: string }> = [
  { value: 'auto', label: 'Automático', hint: 'Lo más grande que quepa en una hoja' },
  { value: 'lg', label: 'Grande', hint: '20 pt' },
  { value: 'md', label: 'Mediano', hint: '16 pt' },
  { value: 'sm', label: 'Compacto', hint: '12 pt' }
]

export const COLUMN_OPTIONS: Array<{ value: SheetColumns; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 1, label: 'Una' },
  { value: 2, label: 'Dos' }
]

const STORAGE_KEY = 'sheetStyle'
const SIZES: unknown[] = SIZE_OPTIONS.map(o => o.value)
const COLUMNS: unknown[] = COLUMN_OPTIONS.map(o => o.value)

export function loadSheetStyle(): SheetStyle {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return {
      size: SIZES.includes(v?.size) ? v.size : DEFAULT_SHEET_STYLE.size,
      columns: COLUMNS.includes(v?.columns) ? v.columns : DEFAULT_SHEET_STYLE.columns
    }
  } catch {
    return DEFAULT_SHEET_STYLE
  }
}

export function saveSheetStyle(style: SheetStyle): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(style))
}

export const sizeLabel = (v: SheetSize) => SIZE_OPTIONS.find(o => o.value === v)?.label ?? v
export const columnsLabel = (v: SheetColumns) => COLUMN_OPTIONS.find(o => o.value === v)?.label ?? String(v)
