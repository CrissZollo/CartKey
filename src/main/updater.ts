import { app, type BrowserWindow } from 'electron'
// electron-updater is CommonJS; under our ESM ("type": "module") build, Node's
// static export analysis doesn't reliably pick up its named exports, so it
// must be imported as a default and destructured at runtime instead.
import electronUpdater, { type UpdateDownloadedEvent } from 'electron-updater'
import type { ReleaseNoteInfo } from 'builder-util-runtime'
import { IPC } from '../shared/ipc'
import type { UpdateStatus } from '../shared/types'

const { autoUpdater } = electronUpdater

function normalizeReleaseNotes(
  notes: string | ReleaseNoteInfo[] | null | undefined
): string {
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  return notes.map((n) => `${n.version}\n${n.note ?? ''}`).join('\n\n')
}

export class UpdaterService {
  private status: UpdateStatus = { state: 'idle' }

  constructor(private mainWindow: BrowserWindow) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('checking-for-update', () => this.setStatus({ state: 'checking' }))
    autoUpdater.on('update-not-available', () => this.setStatus({ state: 'idle' }))
    autoUpdater.on('update-available', (info) => {
      this.setStatus({ state: 'downloading', version: info.version })
    })
    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      this.setStatus({
        state: 'ready',
        version: event.version,
        releaseNotes: normalizeReleaseNotes(event.releaseNotes)
      })
    })
    autoUpdater.on('error', (err) => {
      console.error('[updater] error', err)
      this.setStatus({ state: 'idle' })
    })
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  async checkForUpdates(): Promise<void> {
    // electron-updater has nothing to talk to outside a packaged, published
    // build — running it in dev would just log noise or throw.
    if (!app.isPackaged) {
      console.log('[updater] skipping check — not a packaged build')
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('[updater] check failed', err)
    }
  }

  installNow(): void {
    autoUpdater.quitAndInstall()
  }

  private setStatus(status: UpdateStatus): void {
    this.status = status
    this.mainWindow.webContents.send(IPC.updateStatus, status)
  }
}
