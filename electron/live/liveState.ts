export type LiveChannel = 'live:set-video' | 'live:transition' | 'live:blackout' | 'live:whiteout' | 'live:show-section'

// Section last, so it lands on the right video and style.
const REPLAY_ORDER: LiveChannel[] = ['live:set-video', 'live:transition', 'live:blackout', 'live:whiteout', 'live:show-section']

/**
 * The last payload sent on each live channel. Replayed whenever the live
 * window (re)announces it is ready, so nothing sent before it listened is lost.
 */
export class LiveStateCache {
  private latest = new Map<LiveChannel, unknown>()

  record(channel: LiveChannel, payload: unknown): void {
    this.latest.set(channel, payload)
  }

  replay(send: (channel: LiveChannel, payload: unknown) => void): void {
    for (const channel of REPLAY_ORDER) {
      if (this.latest.has(channel)) send(channel, this.latest.get(channel))
    }
  }

  clear(): void {
    this.latest.clear()
  }
}
