import { create } from 'zustand'
import type { SyncStatus } from './songs.store'
import { useSongsStore } from './songs.store'
import { useSetlistsStore } from './setlists.store'
import { useFoldersStore } from './folders.store'
import { useServiceDraftStore } from './serviceDraft.store'
import { showToast } from './toast.store'

/** ALADO conectado: the computer's sync state, pushed by the main process (sync:status / sync:applied). */
interface SyncState {
  status: SyncStatus
}

const OFF: SyncStatus = { state: 'off', lastOk: null, error: null, unauthorized: false, notices: [], applied: false }

export const useSyncStore = create<SyncState>(() => ({ status: OFF }))

/** Reloads every list after the cloud changed local data. */
async function reloadAll(): Promise<void> {
  await useSongsStore.getState().fetchSongs()
  useServiceDraftStore.getState().syncWithCatalog(useSongsStore.getState().songs)
  await Promise.all([
    useSetlistsStore.getState().fetchSetlists(),
    useFoldersStore.getState().fetchFolders(),
    useFoldersStore.getState().refreshSongsInView(),
  ])
}

let started = false

/** Subscribes once (App mount). */
export function initSync(): void {
  if (started) return
  started = true
  window.api.on('sync:status', (s: unknown) => {
    const status = s as SyncStatus
    useSyncStore.setState({ status })
    for (const n of status.notices ?? []) showToast(n, 'error')
  })
  window.api.on('sync:applied', () => { void reloadAll() })
  window.api.syncGetStatus().then(status => useSyncStore.setState({ status })).catch(() => {})
}
