import { describe, it, expect, beforeEach } from 'vitest'

const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
let windowed = false
let opens = 0
let sections: number[] = []
;(globalThis as any).window = {
  api: {
    openLive: async () => { opens++; await new Promise(r => setTimeout(r, 20)); return { windowed } },
    closeLive: async () => {},
    setVideo: async () => {},
    showSection: async (p: any) => { sections.push(p.sectionIndex) },
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
    await useLiveStore.getState().startLive([song])
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

  it('a second Presentar while the first is still opening is ignored', async () => {
    await useLiveStore.getState().stopLive()
    opens = 0
    sections = []
    const a = useLiveStore.getState().startLive([song])
    const b = useLiveStore.getState().startLive([song])
    await Promise.all([a, b])
    expect(opens).toBe(1)
    expect(sections).toEqual([0])
  })
})
