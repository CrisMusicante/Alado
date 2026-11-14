import { BrowserWindow } from 'electron'
import { PAGE_W, PAGE_H } from './lyricsSheet'

/**
 * Renders a lyrics sheet (lyricsSheet.ts) in a throwaway hidden window. JavaScript is on only for
 * the sheet's own inline fit script: all song text is escaped, the page's CSP blocks any other
 * source, and navigation or popups are refused.
 */
async function withSheetWindow<T>(html: string, offscreen: boolean, fn: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const win = new BrowserWindow({
    show: false, width: PAGE_W, height: PAGE_H, useContentSize: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, offscreen }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', e => e.preventDefault())
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await fn(win)
  } finally {
    win.destroy()
  }
}

export function renderSheetPdf(html: string): Promise<Buffer> {
  return withSheetWindow(html, false, win =>
    win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true }))
}

/** The preview page (one song, possibly several sheets tall) as a PNG data URL. */
export function renderSheetPreview(html: string): Promise<string> {
  return withSheetWindow(html, true, async win => {
    const height = Math.ceil(await win.webContents.executeJavaScript('document.documentElement.scrollHeight') as number)
    win.setContentSize(PAGE_W, Math.max(PAGE_H, height))
    // Let the offscreen renderer paint at the new size before capturing.
    await new Promise(resolve => setTimeout(resolve, 150))
    const image = await win.webContents.capturePage()
    return image.toDataURL()
  })
}
