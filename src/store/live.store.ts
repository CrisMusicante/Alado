import { create } from 'zustand'
import { Song, Section } from './songs.store'

interface LiveState {
  isLive: boolean
  currentSong: Song | null
  currentSectionIndex: number
  blackout: boolean
  whiteout: boolean
  setlist: Song[]

  startLive: (setlist: Song[]) => Promise<void>
  stopLive: () => Promise<void>
  goToSection: (index: number) => Promise<void>
  nextSection: () => Promise<void>
  prevSection: () => Promise<void>
  toggleBlackout: () => Promise<void>
  toggleWhiteout: () => Promise<void>
  changeSong: (song: Song) => Promise<void>
}

export const useLiveStore = create<LiveState>((set, get) => ({
  isLive: false,
  currentSong: null,
  currentSectionIndex: 0,
  blackout: false,
  whiteout: false,
  setlist: [],

  startLive: async (setlist) => {
    await window.api.openLive()
    const song = setlist[0]
    if (song) {
      await window.api.setVideo({ videoPath: song.video_path ?? null })
      await sendSection(song, 0)
    }
    set({ isLive: true, setlist, currentSong: song ?? null, currentSectionIndex: 0 })
  },

  stopLive: async () => {
    await window.api.closeLive()
    set({ isLive: false, currentSong: null, blackout: false, whiteout: false })
  },

  goToSection: async (index) => {
    const { currentSong } = get()
    if (!currentSong) return
    await sendSection(currentSong, index)
    set({ currentSectionIndex: index })
  },

  nextSection: async () => {
    const { currentSong, currentSectionIndex } = get()
    if (!currentSong) return
    const next = currentSectionIndex + 1
    if (next < currentSong.sections.length) {
      await sendSection(currentSong, next)
      set({ currentSectionIndex: next })
    }
  },

  prevSection: async () => {
    const { currentSong, currentSectionIndex } = get()
    if (!currentSong) return
    const prev = currentSectionIndex - 1
    if (prev >= 0) {
      await sendSection(currentSong, prev)
      set({ currentSectionIndex: prev })
    }
  },

  toggleBlackout: async () => {
    const active = !get().blackout
    await window.api.setBlackout(active)
    set({ blackout: active })
  },

  toggleWhiteout: async () => {
    const active = !get().whiteout
    await window.api.setWhiteout(active)
    set({ whiteout: active })
  },

  changeSong: async (song) => {
    await window.api.setVideo({ videoPath: song.video_path ?? null })
    await sendSection(song, 0)
    set({ currentSong: song, currentSectionIndex: 0 })
  }
}))

async function sendSection(song: Song, index: number): Promise<void> {
  const section: Section = song.sections[index]
  if (!section) return
  await window.api.showSection({
    songId: song.id,
    sectionIndex: index,
    text: section.lines.join('\n'),
    lines: section.lines
  })
}
