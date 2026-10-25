export interface Cue {
  sectionIndex: number
  time: number
}

const round = (t: number): number => Math.round(t * 1000) / 1000

export function sectionsSignature(sections: { type: string }[]): string {
  return `${sections.length}:${sections.map(s => s.type).join(',')}`
}

export function cuesAreStale(cues: Cue[], savedSig: string | null, sections: { type: string }[]): boolean {
  if (cues.length === 0) return false
  return savedSig !== sectionsSignature(sections)
}

export function sortCues(cues: Cue[]): Cue[] {
  return [...cues].sort((a, b) => a.time - b.time)
}

/** Index (into sorted cues) of the last cue whose effective time is <= time, or -1. */
export function cuePositionAt(cues: Cue[], time: number, lead = 0): number {
  let pos = -1
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].time - lead <= time + 1e-9) pos = i
    else break
  }
  return pos
}

export function sectionIndexAt(cues: Cue[], time: number, lead = 0): number | null {
  const pos = cuePositionAt(cues, time, lead)
  return pos < 0 ? null : cues[pos].sectionIndex
}

export function nudgeCue(cues: Cue[], index: number, delta: number): Cue[] {
  return sortCues(cues.map((c, i) =>
    i === index ? { ...c, time: Math.max(0, round(c.time + delta)) } : c))
}

export function removeCue(cues: Cue[], index: number): Cue[] {
  return cues.filter((_, i) => i !== index)
}

/** Replace the cue of `sectionIndex` if it has exactly one; otherwise insert a new cue. */
export function upsertCueAt(cues: Cue[], sectionIndex: number, time: number): Cue[] {
  const matches = cues.filter(c => c.sectionIndex === sectionIndex)
  if (matches.length === 1) {
    return sortCues(cues.map(c => c === matches[0] ? { sectionIndex, time: round(time) } : c))
  }
  return sortCues([...cues, { sectionIndex, time: round(time) }])
}

export class CueRecorder {
  private cues: Cue[] = []
  private next = 0
  private last = -1

  constructor(private readonly sectionCount: number) {}

  get nextSection(): number | null {
    return this.next < this.sectionCount ? this.next : null
  }

  get result(): Cue[] {
    return sortCues(this.cues)
  }

  tap(time: number): Cue | null {
    if (this.next >= this.sectionCount) return null
    return this.mark(this.next, time)
  }

  repeat(time: number): Cue | null {
    if (this.last < 0) return null
    const cue = { sectionIndex: this.last, time: round(time) }
    this.cues.push(cue)
    return cue
  }

  mark(sectionIndex: number, time: number): Cue {
    const cue = { sectionIndex, time: round(time) }
    this.cues.push(cue)
    this.last = sectionIndex
    this.next = sectionIndex + 1
    return cue
  }
}

export class CueFollower {
  private readonly cues: Cue[]
  private pos = -1
  private manual = false

  constructor(cues: Cue[], private readonly lead = 0) {
    this.cues = sortCues(cues)
  }

  get isManual(): boolean {
    return this.manual
  }

  /** Returns the section to show when a new cue is crossed, else null. */
  update(time: number): number | null {
    const pos = cuePositionAt(this.cues, time, this.lead)
    if (pos === this.pos) return null
    this.pos = pos
    if (pos < 0) return null
    this.manual = false
    return this.cues[pos].sectionIndex
  }

  seek(time: number): number | null {
    this.manual = false
    this.pos = -2
    return this.update(time)
  }

  markManual(): void {
    this.manual = true
  }

  resumeAuto(time: number): number | null {
    this.manual = false
    this.pos = cuePositionAt(this.cues, time, this.lead)
    return this.pos < 0 ? null : this.cues[this.pos].sectionIndex
  }
}
