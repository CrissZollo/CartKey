import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { IPC } from '../shared/ipc'
import type { CardPayload, Game } from '../shared/types'
import { getLibrary, refreshLibrary } from './library'
import { launchGame } from './launcher'
import { PcscService } from './pcscService'

let pcscService: PcscService | null = null

// nfc-pcsc's native binding sometimes throws PC/SC errors (e.g. cancelling an
// in-flight SCardGetStatusChange when we tear down a stale context) as
// uncaught exceptions instead of catchable 'error' events. Without this, one
// of those would crash the whole app instead of just logging.
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception', err)
})

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
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
  const forceShowTimer = setTimeout(() => mainWindow.show(), 8000)

  mainWindow.on('ready-to-show', () => {
    clearTimeout(forceShowTimer)
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, url) => {
    console.error('[main] did-fail-load', { errorCode, errorDescription, url })
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] render-process-gone', details)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  await refreshLibrary().catch((err) => console.error('[main] refreshLibrary failed', err))

  const mainWindow = createWindow()
  const svc = new PcscService(mainWindow)
  pcscService = svc

  ipcMain.handle(IPC.libraryList, () => getLibrary())
  ipcMain.handle(IPC.libraryRefresh, () => refreshLibrary())
  ipcMain.handle(IPC.launch, (_event, game: Game) => launchGame(game))
  ipcMain.handle(IPC.cardBeginProgram, (_event, payload: CardPayload) => {
    svc.beginProgram(payload)
  })
  ipcMain.handle(IPC.cardCancelProgram, () => {
    svc.cancelProgram()
  })
  ipcMain.handle(IPC.cardConfirmOverwrite, () => svc.confirmOverwrite())
  ipcMain.handle(IPC.readerGetStatus, () => svc.getStatus())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((err) => {
  console.error('[main] startup failed', err)
})

app.on('window-all-closed', () => {
  pcscService?.destroy()
  if (process.platform !== 'darwin') app.quit()
})
