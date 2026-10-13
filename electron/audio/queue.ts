import { AudioStatus, Job } from './types'

export type RunFn = (job: Job, onProgress: (pct: number) => void, signal: AbortSignal) => Promise<void>

export interface QueueEvents {
  onStatus: (songId: number, status: AudioStatus, error?: string) => void
  onProgress: (songId: number, pct: number) => void
}

interface Entry {
  job: Job
  status: AudioStatus
  progress: number
}

export class SeparationQueue {
  private entries: Entry[] = []
  private current: { songId: number; abort: AbortController } | null = null
  private running = false

  constructor(private readonly run: RunFn, private readonly events: QueueEvents) {}

  enqueue(job: Job): void {
    const active = this.entries.some(e =>
      e.job.songId === job.songId && (e.status === 'pending' || e.status === 'processing'))
    if (active) return
    this.entries = this.entries.filter(e => e.job.songId !== job.songId)
    this.entries.push({ job, status: 'pending', progress: 0 })
    this.events.onStatus(job.songId, 'pending')
    void this.drain()
  }

  cancel(songId: number): void {
    const entry = this.entries.find(e => e.job.songId === songId)
    if (!entry) return
    if (entry.status === 'pending') {
      entry.status = 'cancelled'
      this.events.onStatus(songId, 'cancelled')
    } else if (entry.status === 'processing' && this.current?.songId === songId) {
      this.current.abort.abort()
    }
  }

  snapshot(): { songId: number; status: AudioStatus; progress: number }[] {
    return this.entries.map(e => ({ songId: e.job.songId, status: e.status, progress: e.progress }))
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      for (;;) {
        const entry = this.entries.find(e => e.status === 'pending')
        if (!entry) break
        const { songId } = entry.job
        const abort = new AbortController()
        this.current = { songId, abort }
        entry.status = 'processing'
        this.events.onStatus(songId, 'processing')
        try {
          await this.run(entry.job, pct => {
            entry.progress = pct
            this.events.onProgress(songId, pct)
          }, abort.signal)
          entry.status = 'ready'
          entry.progress = 100
          this.events.onStatus(songId, 'ready')
        } catch (e) {
          if (abort.signal.aborted) {
            entry.status = 'cancelled'
            this.events.onStatus(songId, 'cancelled')
          } else {
            entry.status = 'failed'
            this.events.onStatus(songId, 'failed', e instanceof Error ? e.message : String(e))
          }
        } finally {
          this.current = null
        }
      }
    } finally {
      this.running = false
    }
  }
}
