import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToastStore, showToast } from './toast.store'

beforeEach(() => { vi.useFakeTimers(); useToastStore.setState({ toasts: [] }) })
afterEach(() => vi.useRealTimers())

describe('toasts', () => {
  it('showToast agrega un aviso que se oculta solo', () => {
    showToast('Servicio guardado')
    expect(useToastStore.getState().toasts.map(t => [t.message, t.kind])).toEqual([['Servicio guardado', 'success']])
    vi.advanceTimersByTime(3000)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('acepta el tipo error', () => {
    showToast('No se pudo guardar el servicio', 'error')
    expect(useToastStore.getState().toasts[0].kind).toBe('error')
  })
})
