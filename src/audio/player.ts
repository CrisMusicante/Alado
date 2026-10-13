import type { Stem } from './types'

const STEMS: Stem[] = ['instrumental', 'vocals']

/** Plays both stems sample-aligned on one AudioContext clock, each through its own gain. */
export class StemPlayer {
  private ctx = new AudioContext()
  private gains: Record<Stem, GainNode>
  private buffers: Partial<Record<Stem, AudioBuffer>> = {}
  private sources: AudioBufferSourceNode[] = []
  private startedAt = 0
  private offset = 0
  playing = false
  onEnded: (() => void) | null = null

  constructor() {
    this.gains = {
      instrumental: this.ctx.createGain(),
      vocals: this.ctx.createGain()
    }
    STEMS.forEach(s => this.gains[s].connect(this.ctx.destination))
  }

  async load(data: Record<Stem, ArrayBuffer>): Promise<void> {
    this.stopSources()
    this.playing = false
    this.offset = 0
    const decoded = await Promise.all(STEMS.map(s => this.ctx.decodeAudioData(data[s])))
    STEMS.forEach((s, i) => { this.buffers[s] = decoded[i] })
  }

  get duration(): number {
    return this.buffers.instrumental?.duration ?? 0
  }

  get currentTime(): number {
    if (!this.playing) return this.offset
    return Math.max(0, Math.min(this.ctx.currentTime - this.startedAt, this.duration))
  }

  play(): void {
    if (this.playing || !this.buffers.instrumental) return
    void this.ctx.resume()
    const when = this.ctx.currentTime + 0.05
    this.sources = STEMS.map(s => {
      const src = this.ctx.createBufferSource()
      src.buffer = this.buffers[s]!
      src.connect(this.gains[s])
      src.start(when, this.offset)
      return src
    })
    const first = this.sources[0]
    first.onended = () => {
      if (this.sources[0] !== first || !this.playing) return // stopped by pause/seek
      this.playing = false
      this.offset = 0
      this.sources = []
      this.onEnded?.()
    }
    this.startedAt = when - this.offset
    this.playing = true
  }

  pause(): void {
    if (!this.playing) return
    this.offset = this.currentTime
    this.playing = false
    this.stopSources()
  }

  seek(t: number): void {
    const wasPlaying = this.playing
    if (wasPlaying) { this.playing = false; this.stopSources() }
    this.offset = Math.max(0, Math.min(t, this.duration))
    if (wasPlaying) this.play()
  }

  setVolume(stem: Stem, v: number): void {
    this.gains[stem].gain.value = Math.max(0, Math.min(1, v))
  }

  dispose(): void {
    this.stopSources()
    void this.ctx.close()
  }

  private stopSources(): void {
    this.sources.forEach(s => { s.onended = null; try { s.stop() } catch { /* not started */ } })
    this.sources = []
  }
}
