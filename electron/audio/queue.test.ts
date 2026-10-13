import { describe, it, expect, vi } from 'vitest'
import { SeparationQueue, RunFn } from './queue'
import { Job } from './types'

const job = (songId: number): Job => ({ songId, inputPath: `/in/${songId}.mp3`, outDir: `/out/${songId}` })
const flush = () => new Promise(r => setTimeout(r, 0))

function deferredRun() {
  const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void; signal: AbortSignal; progress: (p: number) => void }>()
  const run: RunFn = (j, onProgress, signal) => new Promise<void>((resolve, reject) => {
    pending.set(j.songId, { resolve, reject, signal, progress: onProgress })
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  })
  return { run, pending }
}

describe('SeparationQueue', () => {
  it('runs one job at a time in order', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(2))
    await flush()
    expect([...pending.keys()]).toEqual([1])
    expect(q.snapshot().map(s => s.status)).toEqual(['processing', 'pending'])
    pending.get(1)!.resolve(); await flush()
    expect([...pending.keys()]).toEqual([1, 2])
    expect(onStatus).toHaveBeenCalledWith(1, 'ready')
  })

  it('reports progress', async () => {
    const { run, pending } = deferredRun()
    const onProgress = vi.fn()
    const q = new SeparationQueue(run, { onStatus: vi.fn(), onProgress })
    q.enqueue(job(1)); await flush()
    pending.get(1)!.progress(40)
    expect(onProgress).toHaveBeenCalledWith(1, 40)
    expect(q.snapshot()[0].progress).toBe(40)
  })

  it('marks failure with the error message and continues', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(2)); await flush()
    pending.get(1)!.reject(new Error('Demucs terminó con código 1: archivo inválido'))
    await flush()
    expect(onStatus).toHaveBeenCalledWith(1, 'failed', 'Demucs terminó con código 1: archivo inválido')
    expect(pending.has(2)).toBe(true)
  })

  it('cancels a pending job without running it', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(2)); await flush()
    q.cancel(2)
    pending.get(1)!.resolve(); await flush()
    expect(pending.has(2)).toBe(false)
    expect(onStatus).toHaveBeenCalledWith(2, 'cancelled')
  })

  it('cancels the running job via AbortSignal (e.g. song deleted)', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); await flush()
    q.cancel(1); await flush()
    expect(pending.get(1)!.signal.aborted).toBe(true)
    expect(onStatus).toHaveBeenCalledWith(1, 'cancelled')
    expect(q.snapshot()[0].status).toBe('cancelled')
  })

  it('cancel() resolves only after the running job has fully settled (files released)', async () => {
    let settled = false
    const run: RunFn = (_j, _p, signal) => new Promise<void>((_resolve, reject) => {
      signal.addEventListener('abort', () => setTimeout(() => { settled = true; reject(new Error('killed')) }, 50))
    })
    const q = new SeparationQueue(run, { onStatus: vi.fn(), onProgress: vi.fn() })
    q.enqueue(job(1)); await flush()
    await q.cancel(1)
    expect(settled).toBe(true)
  })

  it('cancel() of an unknown or pending job resolves immediately', async () => {
    const { run } = deferredRun()
    const q = new SeparationQueue(run, { onStatus: vi.fn(), onProgress: vi.fn() })
    await expect(q.cancel(99)).resolves.toBeUndefined()
    q.enqueue(job(1)); q.enqueue(job(2)); await flush()
    await expect(q.cancel(2)).resolves.toBeUndefined()
  })

  it('ignores a duplicate enqueue while pending/processing', async () => {
    const { run } = deferredRun()
    const q = new SeparationQueue(run, { onStatus: vi.fn(), onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(1)); await flush()
    expect(q.snapshot()).toHaveLength(1)
  })
})
