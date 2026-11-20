import { ipcMain, BrowserWindow } from 'electron'
import { LiveStateCache, LiveChannel } from '../live/liveState'

interface TextStyle {
  font: 'sans' | 'rounded' | 'bold-condensed'
  size: 'sm' | 'md' | 'lg' | 'xl'
  color: string
  position: 'top' | 'center' | 'bottom'
  shadow: boolean
  stroke: boolean
}

let liveWindow: BrowserWindow | null = null

const cache = new LiveStateCache()

export function setLiveWindow(win: BrowserWindow | null): void {
  liveWindow = win
}

/** Re-sends the current live state; called each time the live window says it is ready. */
export function replayLiveState(): void {
  cache.replay((channel, payload) => liveWindow?.webContents.send(channel, payload))
}

export function clearLiveState(): void {
  cache.clear()
}

function forward(channel: LiveChannel, payload: unknown): void {
  cache.record(channel, payload)
  liveWindow?.webContents.send(channel, payload)
}

export function registerLiveHandlers(): void {
  ipcMain.handle('live:show-section', (_e, payload: {
    songId: number
    sectionIndex: number
    text: string
    lines: string[]
    textStyle?: Partial<TextStyle>
  }) => {
    forward('live:show-section', payload)
  })

  ipcMain.handle('live:set-video', (_e, payload: { videoPath: string | null }) => {
    forward('live:set-video', payload)
  })

  ipcMain.handle('live:blackout', (_e, payload: { active: boolean }) => {
    forward('live:blackout', payload)
  })

  ipcMain.handle('live:whiteout', (_e, payload: { active: boolean }) => {
    forward('live:whiteout', payload)
  })

  ipcMain.handle('live:transition', (_e, payload: { type: 'fade' | 'cut'; duration: number }) => {
    forward('live:transition', payload)
  })
}
