import type { Cue } from './cues'

export type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'cancelled'
export type Stem = 'instrumental' | 'vocals'

export interface SongAudio {
  song_id: number
  status: AudioStatus
  error: string | null
  original_hash: string | null
  duration_sec: number | null
  vol_instrumental: number
  vol_vocals: number
  cues: Cue[]
  cues_sections_sig: string | null
}

export interface EngineStatus {
  installed: boolean
  version?: string
  platformSupported: boolean
  estimatedInstallBytes: number
}

export interface EngineProgress {
  step: 'download' | 'extract' | 'pip' | 'ffmpeg' | 'selftest'
  pct: number
  message?: string
}

export interface QueueItem {
  songId: number
  status: AudioStatus
  progress: number
}

export type SongAudioPatch = Partial<Pick<SongAudio, 'cues' | 'cues_sections_sig' | 'vol_instrumental' | 'vol_vocals' | 'duration_sec'>>
