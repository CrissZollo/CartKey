import { BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { isAutostartEnabled, setAutostartEnabled } from './autostart'

export function createTray(
  mainWindow: BrowserWindow,
  onQuit: () => void,
  onCheckForUpdates: () => void
): Tray {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('CartKey')

  function showMain(): void {
    mainWindow.show()
    mainWindow.focus()
  }

  function buildMenu(): Menu {
    return Menu.buildFromTemplate([
      { label: 'Open CartKey', click: showMain },
      { type: 'separator' },
      {
        label: 'Launch on login',
        type: 'checkbox',
        checked: isAutostartEnabled(),
        click: (item) => setAutostartEnabled(item.checked)
      },
      { label: 'Check for Updates', click: onCheckForUpdates },
      { type: 'separator' },
      { label: 'Quit', click: onQuit }
    ])
  }

  tray.setContextMenu(buildMenu())
  tray.on('click', showMain)

  return tray
}
