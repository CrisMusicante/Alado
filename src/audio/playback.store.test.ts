import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fake player: decode() resolves only when the test says so, so we can finish B before A.
const decodes: { tag: string; resolve: () => void }[] = []
let active: string | null = null

vi.mock('./player', () => ({
  StemPlayer: class {
    playing = false
    currentTime = 0
    duration = 10
    onEnded: (() => void) | null = null
    decode(data: Record<string, ArrayBuffer>) {
      const tag = new TextDecoder().decode(data.instrumental)
      return new Promise(resolve => decodes.push({ tag, resolve: () => resolve({ tag }) }))
    }
    use(decoded: { tag: string }) { active = decoded.tag }
    pause() {}
    setVolume() {}
  }
}))

const stem = (songId: number) => new TextEncoder().encode(`song-${songId}`)
;(globalThis as any).window = {
  api: {
    audioReadStem: async (songId: number) => stem(songId),
    audioGetSongAudio: async (songId: number) => ({ song_id: songId, vol_instrumental: 1, vol_vocals: 0, duration_sec: 10 }),
    audioUpdate: async () => ({})
  }
}

const { usePlaybackStore } = await import('./playback.store')
const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => { decodes.length = 0; active = null; usePlaybackStore.setState({ songId: null, status: 'idle' }) })

describe('loadSong', () => {
  it('a slower decode of the previous song never replaces the newer one', async () => {
    const a = usePlaybackStore.getState().loadSong(1)
    await flush()
    const b = usePlaybackStore.getState().loadSong(2)
    await flush()
    decodes.find(d => d.tag === 'song-2')!.resolve()
    await b
    decodes.find(d => d.tag === 'song-1')!.resolve()
    await a
    expect(usePlaybackStore.getState().songId).toBe(2)
    expect(usePlaybackStore.getState().status).toBe('ready')
    expect(active).toBe('song-2')
  })

  it('loads a single song normally', async () => {
    const p = usePlaybackStore.getState().loadSong(3)
    await flush()
    decodes[0].resolve()
    await p
    expect(active).toBe('song-3')
    expect(usePlaybackStore.getState().status).toBe('ready')
  })
})
