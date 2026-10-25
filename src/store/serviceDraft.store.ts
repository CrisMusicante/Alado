import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import type { Song } from './songs.store'
import type { SavedSetlist } from './setlists.store'

/**
 * The service (setlist) being built on the Servicio page. Lives outside SetlistPage so it
 * survives switching views, and is persisted so it survives closing the app.
 */

export interface DraftItem {
  key: string
  song: Song
  /** Per-service video override (setlist_items.custom_video); kept so saving doesn't erase it. */
  custom_video: string | null
}

export interface ServiceDraftState {
  setlistId: number | null
  name: string
  serviceDate: string // YYYY-MM-DD
  items: DraftItem[]
  dirty: boolean
  addSong: (song: Song) => void
  removeItem: (key: string) => void
  moveItem: (fromKey: string, toKey: string) => void
  setName: (name: string) => void
  setServiceDate: (date: string) => void
  loadSaved: (saved: SavedSetlist) => void
  reset: () => void
  markSaved: (id: number) => void
  syncWithCatalog: (all: Song[]) => void
}

/** Local date (not UTC) as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

let keySeq = 0
const newKey = (songId?: number) => `${songId ?? 'x'}-${Date.now()}-${keySeq++}`

const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

const blank = () => ({
  setlistId: null,
  name: `Servicio ${new Date().toLocaleDateString('es')}`,
  serviceDate: todayISO(),
  items: [] as DraftItem[],
  dirty: false
})

export const useServiceDraftStore = create<ServiceDraftState>()(persist((set, get) => ({
  ...blank(),

  addSong: (song) => {
    if (get().items.some(i => i.song.id === song.id)) return
    set({ items: [...get().items, { key: newKey(song.id), song, custom_video: null }], dirty: true })
  },

  removeItem: (key) => set({ items: get().items.filter(i => i.key !== key), dirty: true }),

  moveItem: (fromKey, toKey) => {
    const items = [...get().items]
    const from = items.findIndex(i => i.key === fromKey)
    const to = items.findIndex(i => i.key === toKey)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = items.splice(from, 1)
    items.splice(to, 0, moved)
    set({ items, dirty: true })
  },

  setName: (name) => set({ name, dirty: true }),
  setServiceDate: (serviceDate) => set({ serviceDate, dirty: true }),

  loadSaved: (saved) => set({
    setlistId: saved.id ?? null,
    name: saved.name,
    serviceDate: saved.service_date ?? todayISO(),
    items: (saved.songs ?? []).map(s => ({ key: newKey(s.song.id), song: s.song, custom_video: s.custom_video ?? null })),
    dirty: false
  }),

  reset: () => set(blank()),

  markSaved: (id) => set({ setlistId: id, dirty: false }),

  syncWithCatalog: (all) => {
    const byId = new Map(all.map(s => [s.id, s]))
    set({
      items: get().items
        .filter(i => byId.has(i.song.id))
        .map(i => ({ ...i, song: byId.get(i.song.id)! }))
    })
  }
}), {
  name: 'alado-service-draft',
  storage: createJSONStorage(() => (typeof localStorage !== 'undefined' ? localStorage : noopStorage)),
  partialize: ({ setlistId, name, serviceDate, items, dirty }) => ({ setlistId, name, serviceDate, items, dirty })
}))
