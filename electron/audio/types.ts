export type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'cancelled'

export interface Job {
  songId: number
  inputPath: string
  outDir: string
}

export interface Cue {
  sectionIndex: number
  time: number
}
