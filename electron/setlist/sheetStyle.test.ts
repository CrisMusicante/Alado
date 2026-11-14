import { describe, it, expect } from 'vitest'
import { chooseLayout, resolveSheetStyle, parseSheetStyle, DEFAULT_SHEET_STYLE } from './sheetStyle'

/** A fake page: text of `capacity(cols)` "pt-units" fits, i.e. pt * height-factor <= capacity. */
const fitsUpTo = (max1: number, max2: number) => (pt: number, cols: 1 | 2) => pt <= (cols === 1 ? max1 : max2)

describe('chooseLayout', () => {
  it('automático: una columna con la letra más grande que quepa (tope 24 pt)', () => {
    expect(chooseLayout({ size: 'auto', columns: 'auto' }, fitsUpTo(30, 30))).toEqual({ pt: 24, cols: 1 })
    expect(chooseLayout({ size: 'auto', columns: 'auto' }, fitsUpTo(19, 24))).toEqual({ pt: 19, cols: 1 })
  })

  it('automático: pasa a dos columnas si a una quedaría por debajo de 16 pt y a dos es más grande', () => {
    expect(chooseLayout({ size: 'auto', columns: 'auto' }, fitsUpTo(15, 20))).toEqual({ pt: 20, cols: 2 })
    expect(chooseLayout({ size: 'auto', columns: 'auto' }, fitsUpTo(15, 14))).toEqual({ pt: 15, cols: 1 })
  })

  it('automático: si nada cabe usa el mínimo de 14 pt a dos columnas (sigue en otra hoja)', () => {
    expect(chooseLayout({ size: 'auto', columns: 'auto' }, fitsUpTo(10, 12))).toEqual({ pt: 14, cols: 2 })
    expect(chooseLayout({ size: 'auto', columns: 1 }, fitsUpTo(10, 12))).toEqual({ pt: 14, cols: 1 })
  })

  it('automático con columnas fijas solo busca el tamaño', () => {
    expect(chooseLayout({ size: 'auto', columns: 2 }, fitsUpTo(30, 18))).toEqual({ pt: 18, cols: 2 })
  })

  it('tamaño fijo: respeta el tamaño; columnas automáticas prefieren una si cabe', () => {
    expect(chooseLayout({ size: 'lg', columns: 'auto' }, fitsUpTo(22, 30))).toEqual({ pt: 20, cols: 1 })
    expect(chooseLayout({ size: 'lg', columns: 'auto' }, fitsUpTo(18, 30))).toEqual({ pt: 20, cols: 2 })
    expect(chooseLayout({ size: 'sm', columns: 'auto' }, fitsUpTo(5, 5))).toEqual({ pt: 12, cols: 2 })
    expect(chooseLayout({ size: 'md', columns: 1 }, fitsUpTo(5, 5))).toEqual({ pt: 16, cols: 1 })
  })

  it('es autocontenida: se puede inyectar en la página como texto', () => {
    const fn = new Function(`return (${chooseLayout.toString()})`)() as typeof chooseLayout
    expect(fn({ size: 'auto', columns: 'auto' }, fitsUpTo(15, 20))).toEqual({ pt: 20, cols: 2 })
  })
})

describe('resolveSheetStyle / parseSheetStyle', () => {
  it('la canción gana campo por campo; lo que no define viene de la configuración general', () => {
    expect(resolveSheetStyle({ size: 'md', columns: 1 }, null)).toEqual({ size: 'md', columns: 1 })
    expect(resolveSheetStyle({ size: 'md', columns: 1 }, { columns: 2 })).toEqual({ size: 'md', columns: 2 })
    expect(resolveSheetStyle({ size: 'md', columns: 1 }, { size: 'auto' })).toEqual({ size: 'auto', columns: 1 })
  })

  it('descarta valores desconocidos', () => {
    expect(parseSheetStyle({ size: 'enorme', columns: 3 })).toEqual({})
    expect(parseSheetStyle({ size: 'lg', columns: 2, x: 1 })).toEqual({ size: 'lg', columns: 2 })
    expect(parseSheetStyle('{"columns":"auto"}')).toEqual({ columns: 'auto' })
    expect(parseSheetStyle('no json')).toEqual({})
    expect(parseSheetStyle(null)).toEqual({})
    expect(DEFAULT_SHEET_STYLE).toEqual({ size: 'auto', columns: 'auto' })
  })
})
