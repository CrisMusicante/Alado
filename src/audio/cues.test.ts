import { describe, it, expect } from 'vitest'
import {
  Cue, sectionsSignature, cuesAreStale, sectionIndexAt, cuePositionAt,
  nudgeCue, removeCue, upsertCueAt, CueRecorder, CueFollower
} from './cues'

const cues: Cue[] = [
  { sectionIndex: 0, time: 10 },
  { sectionIndex: 1, time: 30 },
  { sectionIndex: 2, time: 50 },
  { sectionIndex: 1, time: 70 } // coro repetido
]

describe('sectionsSignature / cuesAreStale', () => {
  const sections = [{ type: 'verse' }, { type: 'chorus' }]
  it('builds a signature from count and types', () => {
    expect(sectionsSignature(sections)).toBe('2:verse,chorus')
  })
  it('is stale when sections changed after marking', () => {
    expect(cuesAreStale(cues, '2:verse,chorus', [...sections, { type: 'bridge' }])).toBe(true)
  })
  it('is not stale when signature matches', () => {
    expect(cuesAreStale(cues, '2:verse,chorus', sections)).toBe(false)
  })
  it('empty cues are never stale', () => {
    expect(cuesAreStale([], null, sections)).toBe(false)
  })
})

describe('sectionIndexAt', () => {
  it('returns null before the first cue', () => {
    expect(sectionIndexAt(cues, 5)).toBeNull()
  })
  it('returns the last crossed cue', () => {
    expect(sectionIndexAt(cues, 10)).toBe(0)
    expect(sectionIndexAt(cues, 45)).toBe(1)
    expect(sectionIndexAt(cues, 75)).toBe(1)
  })
  it('applies lead (fires earlier)', () => {
    expect(sectionIndexAt(cues, 29.8, 0.3)).toBe(1)
    expect(cuePositionAt(cues, 29.6, 0.3)).toBe(0)
  })
})

describe('editing helpers', () => {
  it('nudges without float noise and keeps order', () => {
    const out = nudgeCue(cues, 1, 0.1)
    expect(out[1].time).toBe(30.1)
  })
  it('nudge never goes below zero and re-sorts', () => {
    const out = nudgeCue([{ sectionIndex: 0, time: 0.05 }, { sectionIndex: 1, time: 0.1 }], 1, -1)
    expect(out.map(c => c.time)).toEqual([0, 0.05])
  })
  it('removes a cue', () => {
    expect(removeCue(cues, 0)).toHaveLength(3)
  })
  it('upsert replaces the single cue of that section', () => {
    const out = upsertCueAt(cues, 2, 52)
    expect(out.filter(c => c.sectionIndex === 2)).toEqual([{ sectionIndex: 2, time: 52 }])
  })
  it('upsert inserts when the section has 0 or several cues', () => {
    expect(upsertCueAt(cues, 1, 90)).toHaveLength(5)
    expect(upsertCueAt(cues, 3, 80)).toHaveLength(5)
  })
})

describe('CueRecorder', () => {
  it('taps advance through sections', () => {
    const r = new CueRecorder(3)
    r.tap(1); r.tap(2); r.tap(3)
    expect(r.result.map(c => c.sectionIndex)).toEqual([0, 1, 2])
    expect(r.nextSection).toBeNull()
    expect(r.tap(4)).toBeNull()
  })
  it('repeat re-marks the last section', () => {
    const r = new CueRecorder(3)
    r.tap(1); r.tap(2); r.repeat(3)
    expect(r.result.map(c => c.sectionIndex)).toEqual([0, 1, 1])
    expect(r.nextSection).toBe(2)
  })
  it('repeat before any tap does nothing', () => {
    expect(new CueRecorder(3).repeat(1)).toBeNull()
  })
  it('mark jumps to any section and continues after it', () => {
    const r = new CueRecorder(3)
    r.tap(1); r.tap(2); r.tap(3); r.mark(1, 4)
    expect(r.result.map(c => c.sectionIndex)).toEqual([0, 1, 2, 1])
    expect(r.nextSection).toBe(2)
  })
})

describe('CueFollower', () => {
  it('fires once per crossed cue', () => {
    const f = new CueFollower(cues)
    expect(f.update(5)).toBeNull()
    expect(f.update(10)).toBe(0)
    expect(f.update(11)).toBeNull()
    expect(f.update(30)).toBe(1)
  })
  it('fires again for a repeated section (new cue position)', () => {
    const f = new CueFollower(cues)
    f.update(50)
    expect(f.update(70)).toBe(1)
  })
  it('manual mode holds until the next cue is crossed', () => {
    const f = new CueFollower(cues)
    f.update(31)
    f.markManual()
    expect(f.isManual).toBe(true)
    expect(f.update(40)).toBeNull()
    expect(f.update(50)).toBe(2)
    expect(f.isManual).toBe(false)
  })
  it('seek jumps to the matching section and leaves manual mode', () => {
    const f = new CueFollower(cues)
    f.update(60)
    f.markManual()
    expect(f.seek(15)).toBe(0)
    expect(f.isManual).toBe(false)
  })
  it('seek before the first cue returns null', () => {
    const f = new CueFollower(cues)
    f.update(40)
    expect(f.seek(1)).toBeNull()
    expect(f.update(10)).toBe(0)
  })
  it('resumeAuto returns the section for the current time', () => {
    const f = new CueFollower(cues)
    f.update(40)
    f.markManual()
    expect(f.resumeAuto(40)).toBe(1)
    expect(f.isManual).toBe(false)
  })
  it('pausing (no time change) never re-fires', () => {
    const f = new CueFollower(cues)
    f.update(30)
    expect(f.update(30)).toBeNull()
    expect(f.update(30)).toBeNull()
  })
})
