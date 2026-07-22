import { app } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Electron's setLoginItemSettings only covers Windows/macOS — Linux needs a
// hand-written XDG autostart .desktop entry instead.
const LINUX_AUTOSTART_DIR = join(homedir(), '.config/autostart')
const LINUX_DESKTOP_FILE = join(LINUX_AUTOSTART_DIR, 'cartkey.desktop')

export function isAutostartEnabled(): boolean {
  if (process.platform === 'linux') {
    return existsSync(LINUX_DESKTOP_FILE)
  }
  return app.getLoginItemSettings().openAtLogin
}

export function setAutostartEnabled(enabled: boolean): void {
  if (process.platform === 'linux') {
    if (enabled) {
      mkdirSync(LINUX_AUTOSTART_DIR, { recursive: true })
      // process.execPath points at the bare Electron binary in dev mode, so
      // this only really does something useful once the app is packaged.
      const execPath = process.env['APPIMAGE'] ?? process.execPath
      const contents = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=CartKey',
        `Exec=${execPath}`,
        'Terminal=false',
        'X-GNOME-Autostart-enabled=true'
      ].join('\n')
      writeFileSync(LINUX_DESKTOP_FILE, contents)
    } else if (existsSync(LINUX_DESKTOP_FILE)) {
      unlinkSync(LINUX_DESKTOP_FILE)
    }
    return
  }
  app.setLoginItemSettings({ openAtLogin: enabled })
}
