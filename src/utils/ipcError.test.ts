import { describe, it, expect } from 'vitest'
import { ipcErrorMessage } from './ipcError'

describe('ipcErrorMessage', () => {
  it('quita el prefijo que agrega ipcRenderer.invoke', () => {
    const e = new Error("Error invoking remote method 'setlist:import-inspect': Error: El archivo no es un servicio de ALADO.")
    expect(ipcErrorMessage(e)).toBe('El archivo no es un servicio de ALADO.')
  })
  it('deja intacto un mensaje sin prefijo', () => {
    expect(ipcErrorMessage(new Error('Algo falló'))).toBe('Algo falló')
    expect(ipcErrorMessage('texto')).toBe('texto')
  })
})
