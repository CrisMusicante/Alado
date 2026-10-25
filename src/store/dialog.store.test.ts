import { describe, it, expect, beforeEach } from 'vitest'
import { useDialogStore, ask, confirmDialog, alertDialog } from './dialog.store'

const answer = (v: string | null) => useDialogStore.getState().answer(v)
const current = () => useDialogStore.getState().current

beforeEach(() => useDialogStore.setState({ current: null, queue: [] }))

describe('in-app dialogs (replace window.confirm, which breaks keyboard focus in Electron on Windows)', () => {
  it('ask resolves with the chosen action value and closes', async () => {
    const p = ask({ title: 'Importar', actions: [{ label: 'Reemplazar', value: 'replace' }, { label: 'Copia', value: 'copy' }] })
    expect(current()?.title).toBe('Importar')
    answer('copy')
    expect(await p).toBe('copy')
    expect(current()).toBeNull()
  })

  it('dismissing resolves null', async () => {
    const p = ask({ title: 'x', actions: [{ label: 'Ok', value: 'ok' }] })
    answer(null)
    expect(await p).toBeNull()
  })

  it('confirmDialog is true only when confirmed', async () => {
    const yes = confirmDialog('¿Eliminar "Fuego"?')
    expect(current()?.actions.map(a => a.label)).toEqual(['Cancelar', 'Aceptar'])
    answer('confirm')
    expect(await yes).toBe(true)

    const no = confirmDialog('¿Eliminar?', { confirmLabel: 'Eliminar', danger: true })
    expect(current()?.actions[1]).toMatchObject({ label: 'Eliminar', variant: 'danger' })
    answer(null)
    expect(await no).toBe(false)
  })

  it('alertDialog shows one button and resolves when closed', async () => {
    const p = alertDialog('No se pudo importar')
    expect(current()?.actions).toHaveLength(1)
    answer(null)
    await expect(p).resolves.toBeUndefined()
  })

  it('queues dialogs opened while another is showing', async () => {
    const a = confirmDialog('primero')
    const b = confirmDialog('segundo')
    expect(current()?.message).toBe('primero')
    answer('confirm')
    expect(await a).toBe(true)
    expect(current()?.message).toBe('segundo')
    answer(null)
    expect(await b).toBe(false)
    expect(current()).toBeNull()
  })
})
