import { screen, BrowserWindow } from 'electron'
import path from 'path'

export function createLiveWindow(): BrowserWindow {
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(d => d.id !== screen.getPrimaryDisplay().id)
  const targetDisplay = externalDisplay ?? screen.getPrimaryDisplay()
  const { x, y, width, height } = targetDisplay.bounds

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: !!externalDisplay,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Required so the renderer (loaded from http:// in dev, file:// in prod)
      // can load local video files via file:/// URIs.
      webSecurity: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173'
    win.loadURL(`${rendererUrl}/src/live/live.html`)
    // Open detached DevTools in dev so errors in the live window are visible
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/live.html'))
  }

  return win
}
