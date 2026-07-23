import { app, shell, screen, BrowserWindow, ipcMain, Tray } from 'electron'
import { join } from 'path'
import { IPC } from '../shared/ipc'
import type { CardPayload, Game } from '../shared/types'
import { getLibrary, refreshLibrary } from './library'
import { launchGame } from './launcher'
import { PcscService } from './pcscService'
import { RemoteService } from './remote/remoteServer'
import { createTray } from './tray'
import { getSettings, updateSettings } from './settingsStore'
import { UpdaterService } from './updater'

let pcscService: PcscService | null = null
let remoteService: RemoteService | null = null
let mainWindow: BrowserWindow | null = null
let toastWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let toastHideTimer: ReturnType<typeof setTimeout> | null = null

// How long the fullscreen toast window stays up after routing an event to
// it. Generous on purpose — it's transparent and click-through-free, so
// staying up a couple seconds longer than the content needs costs nothing,
// while hiding too early would cut off the reveal/countdown/launch sequence.
const TOAST_AUTO_HIDE_MS = 8000

// How often to check GitHub for a new release once the app is packaged.
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

// nfc-pcsc's native binding sometimes throws PC/SC errors (e.g. cancelling an
// in-flight SCardGetStatusChange when we tear down a stale context) as
// uncaught exceptions instead of catchable 'error' events. Without this, one
// of those would crash the whole app instead of just logging.
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception', err)
})

function rendererUrl(query?: string): { loadURL: string } | { loadFile: string; search?: string } {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL']
    return { loadURL: query ? `${base}?${query}` : base }
  }
  return { loadFile: join(__dirname, '../renderer/index.html'), search: query }
}

function loadRenderer(win: BrowserWindow, query?: string): void {
  const target = rendererUrl(query)
  if ('loadURL' in target) {
    win.loadURL(target.loadURL)
  } else {
    win.loadFile(target.loadFile, target.search ? { search: target.search } : undefined)
  }
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d17',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  // Safety net: if the page never paints (crashed GPU, network hiccup on the
  // dev server, etc.) don't leave the user with a permanently invisible app.
  const forceShowTimer = setTimeout(() => win.show(), 8000)

  win.on('ready-to-show', () => {
    clearTimeout(forceShowTimer)
    win.show()
  })

  // Closing the window just hides it — the app keeps running in the tray so
  // cards keep working. Only the tray's "Quit" truly exits.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, url) => {
    console.error('[main] did-fail-load', { errorCode, errorDescription, url })
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] render-process-gone', details)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(win)
  return win
}

/** A fullscreen, transparent, click-through-free overlay used to show the
 * scan/launch reveal when the library window isn't open — so tapping an
 * already-programmed card still works even if the user never opens the app
 * after the first setup. */
function createToastWindow(): BrowserWindow {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: workAreaSize.width,
    height: workAreaSize.height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  loadRenderer(win, 'mode=toast')
  return win
}

/** Decides who should react to a card event right now, and — if it's the
 * toast window — brings it up front for a bit. Reader status always goes to
 * mainWindow separately regardless of this. */
function getCardEventWindow(): BrowserWindow {
  if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
    return mainWindow
  }

  if (!toastWindow) toastWindow = createToastWindow()
  toastWindow.showInactive()

  if (toastHideTimer) clearTimeout(toastHideTimer)
  toastHideTimer = setTimeout(() => toastWindow?.hide(), TOAST_AUTO_HIDE_MS)

  return toastWindow
}

app
  .whenReady()
  .then(async () => {
    const initialLibrary = await refreshLibrary().catch((err) => {
      console.error('[main] refreshLibrary failed', err)
      return getLibrary()
    })

    mainWindow = createMainWindow()
    toastWindow = createToastWindow()

    const svc = new PcscService(mainWindow, getCardEventWindow)
    pcscService = svc

    const remote = await RemoteService.create(mainWindow, getCardEventWindow).catch((err) => {
      console.error('[main] RemoteService failed to start', err)
      return null
    })
    remoteService = remote
    remote?.broadcastLibrary(initialLibrary)

    const updater = new UpdaterService(mainWindow)

    tray = createTray(
      mainWindow,
      () => {
        isQuitting = true
        app.quit()
      },
      () => updater.checkForUpdates()
    )

    ipcMain.handle(IPC.libraryList, () => getLibrary())
    ipcMain.handle(IPC.libraryRefresh, async () => {
      const games = await refreshLibrary()
      remoteService?.broadcastLibrary(games)
      return games
    })
    ipcMain.handle(IPC.launch, (_event, game: Game) => launchGame(game))
    ipcMain.handle(IPC.cardBeginProgram, (_event, payload: CardPayload) => {
      svc.beginProgram(payload)
    })
    ipcMain.handle(IPC.cardBeginErase, () => {
      svc.beginErase()
    })
    ipcMain.handle(IPC.cardCancelProgram, () => {
      svc.cancelProgram()
    })
    ipcMain.handle(IPC.cardConfirmOverwrite, () => svc.confirmOverwrite())
    ipcMain.handle(IPC.readerGetStatus, () => svc.getStatus())
    ipcMain.handle(IPC.updateGetStatus, () => updater.getStatus())
    ipcMain.handle(IPC.updateCheck, () => updater.checkForUpdates())
    ipcMain.handle(IPC.updateInstall, () => updater.installNow())
    ipcMain.handle(IPC.phoneStartPairing, () => remoteService?.startPairing())
    ipcMain.handle(IPC.phoneCancelPairing, () => remoteService?.cancelPairing())
    ipcMain.handle(IPC.phoneListDevices, () => remoteService?.listDevices() ?? [])
    ipcMain.handle(IPC.phoneRevokeDevice, (_event, id: string) => remoteService?.revokeDevice(id))
    ipcMain.handle(IPC.settingsGet, () => getSettings())
    ipcMain.handle(IPC.settingsSet, (_event, patch: Record<string, unknown>) =>
      updateSettings(patch as Record<string, string>)
    )

    app.on('activate', () => {
      mainWindow?.show()
      mainWindow?.focus()
    })

    // Check shortly after launch (packaged builds only — see UpdaterService),
    // then periodically for as long as the app keeps running in the tray.
    setTimeout(() => updater.checkForUpdates(), 5000)
    setInterval(() => updater.checkForUpdates(), UPDATE_CHECK_INTERVAL_MS)
  })
  .catch((err) => {
    console.error('[main] startup failed', err)
  })

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // Windows are hidden, not destroyed, when the user "closes" them — this
  // only fires on a real quit (tray Quit / before-quit), at which point we
  // do want to actually exit.
  if (isQuitting) {
    pcscService?.destroy()
    remoteService?.destroy()
    tray?.destroy()
    if (process.platform !== 'darwin') app.quit()
  }
})
