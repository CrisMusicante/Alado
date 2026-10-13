import { describe, it, expect } from 'vitest'
import { parseDemucsProgress } from './progress'

describe('parseDemucsProgress', () => {
  it('reads a tqdm percentage', () => {
    expect(parseDemucsProgress(' 45%|████▌     | 121.5/270.0 [00:20<00:25,  5.9seconds/s]')).toBe(45)
  })
  it('takes the last value of a chunk with several \\r updates', () => {
    expect(parseDemucsProgress('  3%|▎ | 8/270\r 10%|█ | 27/270\r')).toBe(10)
  })
  it('returns null for unrelated output', () => {
    expect(parseDemucsProgress('Separated tracks will be stored in /tmp/htdemucs')).toBeNull()
  })
  it('caps at 100', () => {
    expect(parseDemucsProgress('100%|██████████| 270.0/270.0')).toBe(100)
  })
})
