# CartKey

Program blank RFID cards with games from your Steam and GOG library, then tap a card on any computer running CartKey to launch that game — even if the app isn't open, since it keeps a lightweight listener running in the background. Programming and scanning both have a playful animated UI — a pixel "suck-in" effect when writing to a card, and a pop-in reveal with a launch countdown when scanning one back.

## How it works

- CartKey scans your local Steam and GOG library and shows them as a grid of cover art. GOG detection goes through **GOG Galaxy** on Windows, or **Heroic Games Launcher** on Linux/Mac (GOG Galaxy itself doesn't run natively there).
- Pick a game, tap a blank card on your reader, and CartKey writes a small record (platform + game ID + title + a fallback art URL) onto the card.
- Tap that card on any computer running CartKey later, and it looks up the game locally (or falls back to what's stored on the card) and launches it.
- Tapping a card that already has a *different* game shows a compare screen before overwriting — you have to confirm, or just remove the card to cancel. Tapping a card that already has the *same* game just tells you so; nothing gets rewritten.
- "Erase a card" wipes a card back to blank — its cover art gets sucked upward and away into nothing (the mirror image of the load animation's pour-in), then the card is zeroed. Tapping an already-blank card in this mode just tells you so.
- Closing the main window doesn't quit CartKey — it keeps running from the tray so cards keep working. Tapping a card while the window is closed pops up a fullscreen reveal overlay for the launch, same as if the window were open. A tray menu option lets you launch CartKey automatically on login, so after the initial install you never have to open it again.
- CartKey checks GitHub for new releases in the background (shortly after launch, then every few hours, or on demand via the tray's "Check for Updates"). When one's downloaded, a modal shows the new version and its changelog — pulled straight from that release's GitHub notes — with a "Restart & Update" button.

**Why something has to run at all**: an NFC/RFID reader has no OS-level "run this action on tap" hook the way phones handle NFC tags — something has to actively watch the reader and react. CartKey's tray-resident background mode is the lightest that's actually possible; genuinely zero installed software isn't achievable with this hardware.

## Requirements

**Hardware**
- A PC/SC-compatible NFC/RFID reader with CCID support (developed and tested against an ACS ACR122U).
- Mifare Classic 1K cards that allow key-based read/write (commonly sold as "magic cards"). Sector 0 is left untouched; game data lives in sectors 1–15 (~720 bytes).

**Software**
- Node.js 22+ and npm.
- [Steam](https://store.steampowered.com/) installed, for library detection.
- Windows: [GOG Galaxy](https://www.gog.com/galaxy) installed, for GOG library detection/launching.
- Linux/Mac: [Heroic Games Launcher](https://heroicgameslauncher.com/) installed instead, for GOG (and Epic) library detection/launching.
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
| `npm run dist` | Builds and packages a distributable (Linux: AppImage + deb + Arch/`.pacman`, Windows: NSIS installer) via electron-builder. Verified working end-to-end on Linux (package metadata for the Arch build checked with `pacman -Qip`) — see Releasing below for how packaged builds actually get published. |

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

## Releasing

Pushing a version tag triggers `.github/workflows/release.yml`, which builds Windows and Linux packages and publishes them as a GitHub Release automatically — no manual `electron-builder --publish` or personal access token needed, it uses the repo's built-in Actions token.

1. Bump `"version"` in `package.json` (e.g. `0.2.0`).
2. Commit, then tag and push:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. The workflow creates a draft release with **auto-generated notes** (from commits since the last release), builds both platforms, uploads the installers plus the `latest.yml`/`latest-linux.yml` metadata electron-updater needs, then un-drafts the release. That release body is exactly what shows up as the changelog in CartKey's update-ready modal.

The repo's Settings → Actions → General → Workflow permissions must allow "Read and write permissions" for this to be able to create releases (usually the default, but worth checking once).

**Do not build the Windows target locally on Linux, even with wine installed.** `electron-builder --win` will happily produce a `CartKey.exe`, but the native PC/SC module (`@pokusew/pcsclite`) can't actually be cross-compiled that way — node-gyp has no real Windows cross-compilation toolchain here, so the "Windows" build silently ends up bundling the *Linux* `.node` binary (verifiable: `file` on the bundled `.node` shows `ELF`, not a Windows DLL). The app would launch on Windows but the card reader would never work. The CI workflow's `windows-latest` job is the only environment that produces a genuine Windows build, because it compiles the native module on real Windows.

## Project structure

```
src/
  main/       Electron main process — PC/SC reader service, Steam/GOG Galaxy/Heroic
              library scanners, game launching, tray + autostart, auto-update
              (electron-updater), window management, IPC handlers
  preload/    contextBridge API exposed to the renderer as window.api
  renderer/   React UI (library grid, card programming flow, scan/launch overlay).
              Loaded in two modes: the normal library window, and a fullscreen
              transparent "toast" window (?mode=toast) used when the library
              window is closed — see src/renderer/src/lib/mode.ts
  shared/     Types, IPC channel definitions, and the card data codec shared
              between main and renderer
```

## Known limitations

- **GOG Galaxy support on Windows is implemented but not yet hardware-tested** — it was built from documented registry keys (`HKLM\Software\GOG.com\Games`) and the community-verified `GalaxyClient.exe /command=runGame` launch invocation, but this project has so far only been developed and run on Linux. Treat it as needing a first real test pass on Windows.
- On Linux/Mac, GOG support is via Heroic Games Launcher's local library, not the native GOG Galaxy client (which doesn't run there).
- Only tested against Mifare Classic 1K cards and an ACR122U reader.
- "Launch on login" only does something useful once CartKey is a packaged, installed app — during `npm run dev` it would just point at the bare Electron binary.
- **Auto-update is wired up but not yet tested against a real published release** — `npm run dist` packaging itself was verified end-to-end on Linux (native module correctly unpacked from asar, app launches, tray/toast windows both work), but the actual electron-updater download/install flow needs GitHub Releases to exist first, which requires pushing a real version tag. Treat the first real release as the actual test of this.
- Windows builds (both GOG Galaxy and the NSIS installer/updater) are entirely unverified — everything Windows-specific in this project has been written without access to a Windows machine.
