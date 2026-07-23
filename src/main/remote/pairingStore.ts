import { app } from 'electron'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/** A paired phone as persisted to disk. Never expose `tokenHash`/`salt` outside
 * this module — see `src/shared/types.ts`'s `PairedDeviceStatus` for the safe
 * shape sent to the renderer. */
export interface PairedDevice {
  id: string
  name: string
  tokenHash: string
  salt: string
  pairedAt: number
  lastSeenAt: number
}

let devices: PairedDevice[] = []
let loaded = false

function storePath(): string {
  return join(app.getPath('userData'), 'paired-devices.json')
}

function load(): void {
  if (loaded) return
  loaded = true
  try {
    if (existsSync(storePath())) {
      devices = JSON.parse(readFileSync(storePath(), 'utf8'))
    }
  } catch (err) {
    console.error('[remote] failed to load paired devices', err)
    devices = []
  }
}

function persist(): void {
  try {
    mkdirSync(join(app.getPath('userData')), { recursive: true })
    writeFileSync(storePath(), JSON.stringify(devices, null, 2))
  } catch (err) {
    console.error('[remote] failed to persist paired devices', err)
  }
}

function hashToken(token: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${token}`).digest('hex')
}

export function listDevices(): PairedDevice[] {
  load()
  return devices
}

/** Registers a newly-paired device and returns the one-time plaintext token —
 * only ever returned here, never persisted or logged. */
export function addDevice(name: string): { device: PairedDevice; token: string } {
  load()
  const token = randomBytes(32).toString('hex')
  const salt = randomBytes(16).toString('hex')
  const device: PairedDevice = {
    id: randomBytes(8).toString('hex'),
    name,
    tokenHash: hashToken(token, salt),
    salt,
    pairedAt: Date.now(),
    lastSeenAt: Date.now()
  }
  devices.push(device)
  persist()
  return { device, token }
}

/** Verifies a device's token with a constant-time comparison, bumping `lastSeenAt` on success. */
export function verifyDevice(id: string, token: string): PairedDevice | null {
  load()
  const device = devices.find((d) => d.id === id)
  if (!device) return null

  const expected = Buffer.from(hashToken(token, device.salt), 'hex')
  const actual = Buffer.from(device.tokenHash, 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  device.lastSeenAt = Date.now()
  persist()
  return device
}

export function removeDevice(id: string): void {
  load()
  devices = devices.filter((d) => d.id !== id)
  persist()
}
