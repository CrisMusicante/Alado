import { describe, it, expect } from 'vitest'
import { planLiveWindow } from './liveDisplay'

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

describe('planLiveWindow', () => {
  it('uses the external display fullscreen', () => {
    const plan = planLiveWindow([
      { id: 1, bounds: rect(0, 0, 1920, 1080), workArea: rect(0, 0, 1920, 1040) },
      { id: 2, bounds: rect(1920, 0, 1280, 720), workArea: rect(1920, 0, 1280, 720) },
    ], 1)
    expect(plan).toEqual({ windowed: false, bounds: rect(1920, 0, 1280, 720) })
  })

  it('falls back to a centered window on the primary work area when only one display', () => {
    const plan = planLiveWindow([{ id: 1, bounds: rect(0, 0, 1920, 1080), workArea: rect(0, 0, 1920, 1040) }], 1)
    expect(plan).toEqual({ windowed: true, bounds: rect(480, 250, 960, 540) })
  })

  it('never exceeds a small work area', () => {
    const plan = planLiveWindow([{ id: 1, bounds: rect(0, 0, 800, 600), workArea: rect(0, 0, 800, 600) }], 1)
    expect(plan.windowed).toBe(true)
    expect(plan.bounds.width).toBeLessThanOrEqual(800)
    expect(plan.bounds.height).toBeLessThanOrEqual(600)
    expect(plan.bounds.width / plan.bounds.height).toBeCloseTo(16 / 9, 1)
  })
})
