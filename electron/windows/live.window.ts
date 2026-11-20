import { screen, BrowserWindow } from 'electron'
import path from 'path'
import { planLiveWindow } from './liveDisplay'

export function createLiveWindow(): { win: BrowserWindow; windowed: boolean } {
  const primaryId = screen.getPrimaryDisplay().id
  const plan = planLiveWindow(
    screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, workArea: d.workArea })),
    primaryId
  )
  const { windowed } = plan

  const win = new BrowserWindow({
    ...plan.bounds,
    fullscreen: !windowed,
    frame: windowed,
    alwaysOnTop: !windowed,
    skipTaskbar: !windowed,
    resizable: windowed,
    title: 'ALADO — Proyección',
    // Windowed: open without stealing focus, so the operator keeps the keyboard
    // and sees the "no second display" warning (shown with showInactive in main).
    show: !windowed,
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
    win.loadFile(path.join(__dirname, '../renderer/src/live/live.html'))
  }

  return { win, windowed }
}
