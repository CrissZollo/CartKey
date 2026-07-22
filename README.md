# CartKey

Program blank RFID cards with games from your Steam and GOG (via Heroic) library, then tap a card on any computer running CartKey to launch that game. Programming and scanning both have a playful animated UI — a pixel "suck-in" effect when writing to a card, and a pop-in reveal with a launch countdown when scanning one back.

## How it works

- CartKey scans your local Steam and Heroic Games Launcher libraries and shows them as a grid of cover art.
- Pick a game, tap a blank card on your reader, and CartKey writes a small record (platform + game ID + title + a fallback art URL) onto the card.
- Tap that card on any computer running CartKey later, and it looks up the game locally (or falls back to what's stored on the card) and launches it.
- Tapping a card that already has a *different* game shows a compare screen before overwriting — you have to confirm, or just remove the card to cancel. Tapping a card that already has the *same* game just tells you so; nothing gets rewritten.

## Requirements

**Hardware**
- A PC/SC-compatible NFC/RFID reader with CCID support (developed and tested against an ACS ACR122U).
- Mifare Classic 1K cards that allow key-based read/write (commonly sold as "magic cards"). Sector 0 is left untouched; game data lives in sectors 1–15 (~720 bytes).

**Software**
- Node.js 22+ and npm.
- [Steam](https://store.steampowered.com/) and/or [Heroic Games Launcher](https://heroicgameslauncher.com/) installed, for library detection. GOG support goes through Heroic, not the native GOG Galaxy client.
- Linux: `pcscd` and `ccid` installed and running (see Troubleshooting below — this is the single most common thing that goes wrong).

## Getting started

```bash
npm install
npm run dev
```

`npm install` also rebuilds the native PC/SC binding (`@pokusew/pcsclite`) against Electron's Node ABI automatically via a `postinstall` script — this is required for the reader to work at all under Electron, and running a plain `npm rebuild` instead will produce a binary that crashes on load.

Other scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app in development mode with hot reload. |
| `npm run typecheck` | Type-checks the main, preload, and renderer processes. |
| `npm run build` | Builds the app (no packaging). |
| `npm run dist` | Builds and packages a distributable via electron-builder. **Not yet configured** — no app icon or `electron-builder` config exists yet, so this currently uses bare defaults. |

## Troubleshooting (Linux)

If the reader shows as "No reader detected" in the app:

1. **Is `pcscd` running?**
   ```bash
   sudo systemctl enable --now pcscd.socket
   ```
   Without this, the app can't reach the reader at all.

2. **Is the `ccid` driver installed?**
   ```bash
   sudo pacman -S ccid       # Arch
   ```
   pcscd needs this to talk to USB smart-card readers. Check `journalctl -u pcscd` for `Can't claim interface ... LIBUSB_ERROR_BUSY` if unsure.

3. **PN532/PN533-based readers (including the ACR122U) conflict with Linux's own kernel NFC driver.** The kernel's `pn533_usb` module auto-claims the device for its own NFC subsystem, which blocks pcscd every time the reader is plugged in. Fix:
   ```bash
   sudo modprobe -r pn533_usb pn533 nfc
   ```
   To make this permanent (recommended — otherwise it recurs on every reboot/replug):
   ```bash
   echo "blacklist pn533_usb" | sudo tee /etc/modprobe.d/blacklist-pn533.conf
   ```

CartKey's own PC/SC connection self-heals from reader unplug/replug and pcscd restarts once the above is set up correctly — no need to restart the app.

## Project structure

```
src/
  main/       Electron main process — PC/SC reader service, Steam/Heroic library
              scanners, game launching, IPC handlers
  preload/    contextBridge API exposed to the renderer as window.api
  renderer/   React UI (library grid, card programming flow, scan/launch overlay)
  shared/     Types, IPC channel definitions, and the card data codec shared
              between main and renderer
```

## Known limitations

- GOG support is via Heroic Games Launcher's local library, not the native GOG Galaxy client (which doesn't run on Linux).
- Only tested against Mifare Classic 1K cards and an ACR122U reader.
- No packaged/installable build yet — runs via `npm run dev`.
