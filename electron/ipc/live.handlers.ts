import { ipcMain, BrowserWindow } from 'electron'

let liveWindow: BrowserWindow | null = null

export function setLiveWindow(win: BrowserWindow | null): void {
  liveWindow = win
}

export function registerLiveHandlers(): void {
  ipcMain.handle('live:show-section', (_e, payload: {
    songId: number
    sectionIndex: number
    text: string
    lines: string[]
  }) => {
    liveWindow?.webContents.send('live:show-section', payload)
  })

  ipcMain.handle('live:set-video', (_e, payload: { videoPath: string | null }) => {
    liveWindow?.webContents.send('live:set-video', payload)
  })

  ipcMain.handle('live:blackout', (_e, payload: { active: boolean }) => {
    liveWindow?.webContents.send('live:blackout', payload)
  })

  ipcMain.handle('live:whiteout', (_e, payload: { active: boolean }) => {
    liveWindow?.webContents.send('live:whiteout', payload)
  })

  ipcMain.handle('live:transition', (_e, payload: { type: 'fade' | 'cut'; duration: number }) => {
    liveWindow?.webContents.send('live:transition', payload)
  })
}
