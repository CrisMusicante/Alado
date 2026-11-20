// Suppress dev-only CSP warning caused by Vite HMR requiring unsafe-eval
if (process.env.NODE_ENV === 'development') {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
}

import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/main.window'
import { createLiveWindow } from './windows/live.window'
import { registerDbHandlers } from './ipc/db.handlers'
import { registerVideosHandlers } from './ipc/videos.handlers'
import { registerLiveHandlers, setLiveWindow, replayLiveState, clearLiveState } from './ipc/live.handlers'
import { registerSystemHandlers } from './ipc/system.handlers'
import { registerLyricsHandlers } from './ipc/lyrics.handlers'
import { registerAudioHandlers } from './ipc/audio.handlers'
import { registerPackHandlers } from './ipc/pack.handlers'
import { registerSetlistHandlers } from './ipc/setlist.handlers'
import { registerSyncHandlers } from './ipc/sync.handlers'
import type { SyncService } from './sync/service'
import { registerMediaSchemePrivileges, registerMediaProtocol } from './media/protocol'
import { ipcMain } from 'electron'

registerMediaSchemePrivileges()

let mainWindow: BrowserWindow | null = null
let liveWindow: BrowserWindow | null = null
let liveWindowed = false
let sync: SyncService | null = null

app.whenReady().then(() => {
  registerMediaProtocol()
  registerDbHandlers()
  registerLiveHandlers()
  registerSystemHandlers()
  registerLyricsHandlers()
  registerAudioHandlers(() => mainWindow)
  registerPackHandlers()
  registerSetlistHandlers()
  registerVideosHandlers()

  mainWindow = createMainWindow()

  // ALADO conectado: sync at start (once the UI can show it), then on timers. Never blocks the app.
  sync = registerSyncHandlers(() => mainWindow, () => !!liveWindow && !liveWindow.isDestroyed())
  mainWindow.webContents.once('did-finish-load', () => sync?.start())

  // Open/close Live window on demand from renderer
  ipcMain.handle('live:open', async () => {
    if (!liveWindow || liveWindow.isDestroyed()) {
      const created = createLiveWindow()
      liveWindow = created.win
      liveWindowed = created.windowed
      setLiveWindow(liveWindow)
      liveWindow.on('closed', () => {
        liveWindow = null
        setLiveWindow(null)
        clearLiveState()
        mainWindow?.webContents.send('live:closed')
        // Changes held during the projection are applied now.
        void sync?.run()
      })

      // Replay the current state on every ready (also after a reload or a
      // load slower than the wait below), so the first section is never lost.
      liveWindow.webContents.ipc.on('live:renderer-ready', replayLiveState)

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
    // Closed from its frame while still loading.
    if (!liveWindow) return { windowed: liveWindowed }
    if (liveWindowed) {
      liveWindow.showInactive()
      mainWindow?.focus()
    } else {
      liveWindow.show()
    }
    return { windowed: liveWindowed }
  })

  ipcMain.handle('live:close', () => {
    liveWindow?.close()
  })

  // Esc inside the projection: with a single display it may be the only window in view.
  ipcMain.on('live:escape', () => {
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
