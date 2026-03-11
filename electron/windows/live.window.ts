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
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/live.html`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/live.html'))
  }

  return win
}
