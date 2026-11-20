import { describe, it, expect } from 'vitest'
import { LiveStateCache } from './liveState'

const sent = (c: LiveStateCache) => {
  const out: [string, unknown][] = []
  c.replay((ch, p) => out.push([ch, p]))
  return out
}

describe('LiveStateCache', () => {
  it('replays the latest state after a late ready', () => {
    const c = new LiveStateCache()
    c.record('live:set-video', { videoPath: 'a.mp4' })
    c.record('live:show-section', { sectionIndex: 0 })
    c.record('live:show-section', { sectionIndex: 1 })
    expect(sent(c)).toEqual([
      ['live:set-video', { videoPath: 'a.mp4' }],
      ['live:show-section', { sectionIndex: 1 }],
    ])
  })

  it('replays on every ready, not only the first', () => {
    const c = new LiveStateCache()
    c.record('live:blackout', { active: true })
    sent(c)
    expect(sent(c)).toEqual([['live:blackout', { active: true }]])
  })

  it('sends the section last so it shows over the right video and style', () => {
    const c = new LiveStateCache()
    c.record('live:show-section', { sectionIndex: 0 })
    c.record('live:transition', { type: 'cut', duration: 0 })
    c.record('live:whiteout', { active: false })
    c.record('live:set-video', { videoPath: null })
    expect(sent(c).map(([ch]) => ch)).toEqual(['live:set-video', 'live:transition', 'live:whiteout', 'live:show-section'])
  })

  it('clear forgets everything', () => {
    const c = new LiveStateCache()
    c.record('live:show-section', { sectionIndex: 0 })
    c.clear()
    expect(sent(c)).toEqual([])
  })
})
