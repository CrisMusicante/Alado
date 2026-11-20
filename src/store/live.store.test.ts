import { describe, it, expect, beforeEach } from 'vitest'

const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
let windowed = false
;(globalThis as any).window = {
  api: {
    openLive: async () => ({ windowed }),
    closeLive: async () => {},
    setVideo: async () => {},
    showSection: async () => {},
    on: (channel: string, cb: (...args: unknown[]) => void) => { (listeners[channel] ??= []).push(cb) },
  }
}

const { useLiveStore } = await import('./live.store')
const { useDialogStore } = await import('./dialog.store')

const song = { id: 1, title: 'Tu fidelidad', sections: [{ type: 'verse', label: 'Verso 1', lines: ['Oh Dios'] }], text_style: {} } as any

beforeEach(() => {
  windowed = false
  useDialogStore.setState({ current: null } as any)
})

describe('live store', () => {
  it('warns when the projection opened windowed', async () => {
    windowed = true
    void useLiveStore.getState().startLive([song])
    await new Promise(r => setTimeout(r, 0))
    expect(useDialogStore.getState().current?.message).toBe(
      'No hay segunda pantalla. La proyección se abrió en una ventana: en Windows usa Win+P → Extender.'
    )
  })

  it('does not warn with a second display', async () => {
    await useLiveStore.getState().startLive([song])
    expect(useDialogStore.getState().current).toBeNull()
  })

  it('resets when the live window closes', async () => {
    await useLiveStore.getState().startLive([song])
    expect(useLiveStore.getState().isLive).toBe(true)
    listeners['live:closed']?.forEach(cb => cb())
    expect(useLiveStore.getState().isLive).toBe(false)
    expect(useLiveStore.getState().currentSong).toBeNull()
  })
})
