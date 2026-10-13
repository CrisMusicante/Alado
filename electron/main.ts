// Suppress dev-only CSP warning caused by Vite HMR requiring unsafe-eval
if (process.env.NODE_ENV === 'development') {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
}

import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/main.window'
import { createLiveWindow } from './windows/live.window'
import { registerDbHandlers } from './ipc/db.handlers'
import { registerLiveHandlers, setLiveWindow } from './ipc/live.handlers'
import { registerSystemHandlers } from './ipc/system.handlers'
import { registerLyricsHandlers } from './ipc/lyrics.handlers'
import { registerAudioHandlers } from './ipc/audio.handlers'
import { ipcMain } from 'electron'

let mainWindow: BrowserWindow | null = null
let liveWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  registerDbHandlers()
  registerLiveHandlers()
  registerSystemHandlers()
  registerLyricsHandlers()
  registerAudioHandlers(() => mainWindow)

  mainWindow = createMainWindow()

  // Open/close Live window on demand from renderer
  ipcMain.handle('live:open', async () => {
    if (!liveWindow || liveWindow.isDestroyed()) {
      liveWindow = createLiveWindow()
      setLiveWindow(liveWindow)
      liveWindow.on('closed', () => {
        liveWindow = null
        setLiveWindow(null)
        mainWindow?.webContents.send('live:closed')
      })

      // Wait for the live renderer to mount and attach its IPC listeners before
      // returning — this ensures setVideo / showSection are not sent into the void.
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000) // fallback: give up after 5s
        liveWindow!.webContents.ipc.once('live:renderer-ready', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    }
    liveWindow.show()
  })

  ipcMain.handle('live:close', () => {
    liveWindow?.close()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
