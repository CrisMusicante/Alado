import { describe, it, expect, beforeEach, vi } from 'vitest'

const listeners: Record<string, ((p: unknown) => void)[]> = {}
const calls: string[] = []
;(globalThis as any).window = {
  api: {
    on: (c: string, cb: (p: unknown) => void) => { (listeners[c] ??= []).push(cb) },
    syncGetStatus: async () => ({ state: 'off', lastOk: null, error: null, unauthorized: false, notices: [], applied: false }),
    getSongs: async () => { calls.push('songs'); return [] },
    getSetlists: async () => { calls.push('setlists'); return [] },
    getFolders: async () => { calls.push('folders'); return [] },
    getSongsInFolder: async () => { calls.push('songsInFolder'); return [] },
  },
}

const { useSyncStore, initSync } = await import('./sync.store')
const { useToastStore } = await import('./toast.store')
const emit = (c: string, p: unknown) => listeners[c]?.forEach(cb => cb(p))

beforeEach(() => { calls.length = 0; useToastStore.setState({ toasts: [] }) })

describe('sync store', () => {
  it('status updates from push channel and notices become toasts', async () => {
    initSync()
    emit('sync:status', { state: 'ok', lastOk: '2026-11-22T10:00:00Z', error: null, unauthorized: false, notices: ['Tu cambio fue reemplazado.'], applied: false })
    expect(useSyncStore.getState().status.state).toBe('ok')
    expect(useToastStore.getState().toasts.map(t => t.message)).toEqual(['Tu cambio fue reemplazado.'])
  })

  it('applied triggers a reload of songs, folders and setlists', async () => {
    initSync()
    emit('sync:applied', null)
    await vi.waitFor(() => expect(calls).toEqual(expect.arrayContaining(['songs', 'setlists', 'folders'])))
  })
})
