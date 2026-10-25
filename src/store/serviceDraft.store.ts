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
  /** Optional description, stored in setlists.notes. */
  notes: string
  /** True while the name is still the automatic "Servicio DD/MM/AAAA"; it then follows the date. */
  nameIsDefault: boolean
  items: DraftItem[]
  dirty: boolean
  addSong: (song: Song) => void
  removeItem: (key: string) => void
  moveItem: (fromKey: string, toKey: string) => void
  setName: (name: string) => void
  setServiceDate: (date: string) => void
  setNotes: (notes: string) => void
  forgetSavedSetlist: (id: number) => void
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

/** "25/10/2026" for 2026-10-25. */
export function formatServiceDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** "Servicio 25/10/2026" for 2026-10-25. */
export function defaultServiceName(date: string): string {
  return `Servicio ${formatServiceDate(date)}`
}

/**
 * Persisted drafts from before v1 have no nameIsDefault/notes: keep a custom name custom
 * (otherwise changing the date would overwrite it).
 */
export function migrateDraft(persisted: any, version: number): any {
  if (version < 1 && persisted) {
    const date = persisted.serviceDate ?? todayISO()
    return { ...persisted, notes: persisted.notes ?? '', nameIsDefault: persisted.name === defaultServiceName(date) }
  }
  return persisted
}

let keySeq = 0
const newKey = (songId?: number) => `${songId ?? 'x'}-${Date.now()}-${keySeq++}`

const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

const blank = () => ({
  setlistId: null,
  name: defaultServiceName(todayISO()),
  nameIsDefault: true,
  notes: '',
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

  setName: (name) => set({ name, nameIsDefault: false, dirty: true }),
  setServiceDate: (serviceDate) => set({
    serviceDate,
    ...(get().nameIsDefault ? { name: defaultServiceName(serviceDate) } : {}),
    dirty: true
  }),
  setNotes: (notes) => set({ notes, dirty: true }),

  // The saved service this draft points at was deleted: the next save must create a new one.
  forgetSavedSetlist: (id) => {
    if (get().setlistId === id) set({ setlistId: null, dirty: true })
  },

  loadSaved: (saved) => set({
    setlistId: saved.id ?? null,
    name: saved.name,
    nameIsDefault: saved.name === defaultServiceName(saved.service_date ?? todayISO()),
    notes: saved.notes ?? '',
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
  version: 1,
  migrate: migrateDraft,
  storage: createJSONStorage(() => (typeof localStorage !== 'undefined' ? localStorage : noopStorage)),
  partialize: ({ setlistId, name, nameIsDefault, notes, serviceDate, items, dirty }) =>
    ({ setlistId, name, nameIsDefault, notes, serviceDate, items, dirty })
}))
