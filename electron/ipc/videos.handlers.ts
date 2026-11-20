import { app, dialog, ipcMain } from 'electron'
import path from 'path'
import { listVideos, importVideo } from '../media/videoLibrary'

const videosDir = () => path.join(app.getPath('userData'), 'videos')

export function registerVideosHandlers(): void {
  ipcMain.handle('videos:list', () => listVideos(videosDir()))

  ipcMain.handle('videos:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'webm', 'mov'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return importVideo(result.filePaths[0], videosDir())
  })
}
