export type Rect = { x: number; y: number; width: number; height: number }

export interface DisplayInfo {
  id: number
  bounds: Rect
  workArea: Rect
}

export type LiveWindowPlan = { windowed: false; bounds: Rect } | { windowed: true; bounds: Rect }

/**
 * Fullscreen on the first non-primary display. With a single display (e.g. Windows
 * set to "Duplicate"), a normal 16:9 window at half the work area width, centered,
 * so the projection never covers the operator's app.
 */
export function planLiveWindow(displays: DisplayInfo[], primaryId: number): LiveWindowPlan {
  const external = displays.find(d => d.id !== primaryId)
  if (external) return { windowed: false, bounds: external.bounds }

  const area = (displays.find(d => d.id === primaryId) ?? displays[0]).workArea
  let width = Math.round(area.width / 2)
  let height = Math.round(width * 9 / 16)
  if (height > area.height) {
    height = area.height
    width = Math.round(height * 16 / 9)
  }
  return {
    windowed: true,
    bounds: {
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height,
    },
  }
}
