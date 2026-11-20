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
  reconcileDraft()
}

const draftKey = (name: string, date: string | null | undefined, notes: string | null | undefined, ids: (number | undefined)[]) =>
  JSON.stringify([name, date ?? '', notes ?? '', ids])

/**
 * The service open on the Servicio page may have changed (or vanished) in the cloud. Unchanged
 * drafts follow the cloud; unsaved edits are kept with a warning (saving them is a newer edit);
 * a deleted service is forgotten so saving creates it again instead of failing.
 */
function reconcileDraft(): void {
  const draft = useServiceDraftStore.getState()
  if (!draft.setlistId) return
  const saved = useSetlistsStore.getState().setlists.find(s => s.id === draft.setlistId)
  if (!saved) {
    draft.forgetSavedSetlist(draft.setlistId)
    showToast('El servicio abierto se borró en la nube; si lo guardas se crea de nuevo.', 'error')
    return
  }
  const cloud = draftKey(saved.name, saved.service_date, saved.notes, (saved.songs ?? []).map(s => s.song.id))
  const here = draftKey(draft.name, draft.serviceDate, draft.notes, draft.items.map(i => i.song.id))
  if (cloud === here) return
  if (draft.dirty) showToast(`El servicio «${saved.name}» cambió en la nube; tienes cambios sin guardar aquí.`, 'error')
  else draft.loadSaved(saved)
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
