import { describe, it, expect, beforeEach, vi } from 'vitest'

const listeners: Record<string, ((p: unknown) => void)[]> = {}
let savedSetlists: any[] = []
const calls: string[] = []
;(globalThis as any).window = {
  api: {
    on: (c: string, cb: (p: unknown) => void) => { (listeners[c] ??= []).push(cb) },
    syncGetStatus: async () => ({ state: 'off', lastOk: null, error: null, unauthorized: false, notices: [], applied: false }),
    getSongs: async () => { calls.push('songs'); return [] },
    getSetlists: async () => { calls.push('setlists'); return savedSetlists },
    getFolders: async () => { calls.push('folders'); return [] },
    getSongsInFolder: async () => { calls.push('songsInFolder'); return [] },
  },
}

const { useSyncStore, initSync } = await import('./sync.store')
const { useToastStore } = await import('./toast.store')
const { useServiceDraftStore } = await import('./serviceDraft.store')
const song = { id: 1, title: 'Uno', sections: [], text_style: {} }
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

  it('the open service is reloaded when the cloud changed it and nothing is unsaved here', async () => {
    initSync()
    useServiceDraftStore.getState().loadSaved({ id: 7, name: 'Domingo', service_date: '2026-11-22', songs: [] })
    savedSetlists = [{ id: 7, name: 'Domingo', service_date: '2026-11-22', songs: [{ song, position: 0 }] }]
    emit('sync:applied', null)
    await vi.waitFor(() => expect(useServiceDraftStore.getState().items).toHaveLength(1))
    expect(useServiceDraftStore.getState().dirty).toBe(false)
  })

  it('unsaved edits are kept and the operator is warned', async () => {
    initSync()
    useServiceDraftStore.getState().loadSaved({ id: 7, name: 'Domingo', service_date: '2026-11-22', songs: [] })
    useServiceDraftStore.getState().setNotes('mío')
    savedSetlists = [{ id: 7, name: 'Domingo', service_date: '2026-11-22', songs: [{ song, position: 0 }] }]
    emit('sync:applied', null)
    await vi.waitFor(() => expect(useToastStore.getState().toasts.map(t => t.message).join(' ')).toMatch(/cambió en la nube/))
    expect(useServiceDraftStore.getState().items).toHaveLength(0)
  })

  it('a service deleted in the cloud is forgotten so saving creates it again', async () => {
    initSync()
    useServiceDraftStore.getState().loadSaved({ id: 7, name: 'Domingo', service_date: '2026-11-22', songs: [] })
    savedSetlists = []
    emit('sync:applied', null)
    await vi.waitFor(() => expect(useServiceDraftStore.getState().setlistId).toBeNull())
  })
})

