import { ipcMain, screen, dialog } from 'electron'

export function registerSystemHandlers(): void {
  ipcMain.handle('system:get-displays', () => {
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label,
      bounds: d.bounds,
      isPrimary: d.id === screen.getPrimaryDisplay().id
    }))
  })

  ipcMain.handle('system:open-file-dialog', async (_e, filters: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.canceled ? null : result.filePaths[0]
  })
}
