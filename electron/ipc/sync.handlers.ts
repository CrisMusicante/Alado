import { app, ipcMain, safeStorage, BrowserWindow } from 'electron'
import os from 'os'
import path from 'path'
import { getDb } from '../db/database'
import { SyncService } from '../sync/service'
import { CLOUD_URL } from '../sync/config'

let service: SyncService | null = null

/** Device token at rest: OS-encrypted (DPAPI on Windows); never stored in the clear. */
const secret = {
  encrypt: (s: string) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Este equipo no puede cifrar el acceso a la nube; no se vinculó.')
    return `safe:${safeStorage.encryptString(s).toString('base64')}`
  },
  decrypt: (s: string) => s.startsWith('safe:')
    ? safeStorage.decryptString(Buffer.from(s.slice(5), 'base64')) : s.replace(/^plain:/, ''),
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function registerSyncHandlers(getMainWindow: () => BrowserWindow | null, isLive: () => boolean): SyncService {
  service = new SyncService({
    db: getDb(),
    // ALADO_CLOUD_URL (tests against a local cloud) is honored only outside the installed app.
    cloudUrl: (!app.isPackaged && process.env.ALADO_CLOUD_URL) || CLOUD_URL,
    fetch: globalThis.fetch,
    videosDir: path.join(app.getPath('userData'), 'videos'),
    backupDir: path.join(app.getPath('userData'), 'backups'),
    isLive,
    send: (channel, payload) => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
    },
    secret,
    deviceName: os.hostname() || 'Compu',
    now: () => new Date(),
  })
  const s = service

  ipcMain.handle('sync:get-status', () => s.status())
  ipcMain.handle('sync:info', () => s.info())
  ipcMain.handle('sync:run', () => s.run({ force: true }))
  ipcMain.handle('sync:setup', (_e, p: Record<string, unknown>) => s.setup({
    churchName: str(p?.churchName, 200), leaderName: str(p?.leaderName, 100), pin: str(p?.pin, 8), setupKey: str(p?.setupKey, 64),
  }))
  ipcMain.handle('sync:link', (_e, p: Record<string, unknown>) => s.link({ code: str(p?.code, 20) }))
  ipcMain.handle('sync:unlink', () => s.unlink())
  return s
}
