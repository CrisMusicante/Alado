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
import { ipcMain } from 'electron'

let mainWindow: BrowserWindow | null = null
let liveWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  registerDbHandlers()
  registerLiveHandlers()
  registerSystemHandlers()

  mainWindow = createMainWindow()

  // Open/close Live window on demand from renderer
  ipcMain.handle('live:open', () => {
    if (!liveWindow || liveWindow.isDestroyed()) {
      liveWindow = createLiveWindow()
      setLiveWindow(liveWindow)
      liveWindow.on('closed', () => {
        liveWindow = null
        setLiveWindow(null)
        mainWindow?.webContents.send('live:closed')
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
