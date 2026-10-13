import { describe, it, expect, vi } from 'vitest'
import path from 'path'

vi.mock('electron', () => ({ app: { getPath: () => path.join('C:', 'Users', 'José Ñúñez', 'AppData', 'Roaming', 'alado') } }))

const { getDemucsCommand } = await import('./engine')

describe('getDemucsCommand', () => {
  it('forces UTF-8 in Python so non-ASCII Windows usernames survive stdout/paths', () => {
    expect(getDemucsCommand().env?.PYTHONUTF8).toBe('1')
  })
  it('keeps model weights inside the engine folder', () => {
    const env = getDemucsCommand().env!
    expect(env.HF_HOME).toContain(path.join('audio-engine', 'models'))
    expect(env.TORCH_HOME).toContain(path.join('audio-engine', 'models'))
  })
  it('decodes inputs with the engine ffmpeg (Demucs alone cannot read m4a)', () => {
    const ff = getDemucsCommand().ffmpeg
    expect(ff?.file).toMatch(/audio-engine[\\/]bin[\\/]ffmpeg(\.exe)?$/)
  })
})
