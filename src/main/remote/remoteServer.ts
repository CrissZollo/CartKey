import type { BrowserWindow } from 'electron'
import { createServer, type Server as HttpsServer } from 'https'
import type { IncomingMessage, ServerResponse } from 'http'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import { fileURLToPath } from 'url'
import { hostname, networkInterfaces } from 'os'
import { IPC, type CardEventFromMain } from '../../shared/ipc'
import { buildPairingUri, type PcToPhone, type PhoneToPc } from '../../shared/remoteProtocol'
import type { CardTapEvent, Game, PairedDeviceStatus, PairingSession } from '../../shared/types'
import { findGame, getLibrary } from '../library'
import { getTlsIdentity, type TlsIdentity } from './tls'
import {
  addDevice,
  listDevices as listPairedDevices,
  removeDevice,
  verifyDevice
} from './pairingStore'
import { cancelPairingSession, consumePairingCode, startPairingSession } from './pairingSession'

// Arbitrary fixed port in the dynamic/private range — unlikely to collide
// with anything else running on a user's machine.
const REMOTE_PORT = 47821
// A connection that never completes `pair`/`auth` within this window is
// dropped, so idle/garbage connections can't accumulate indefinitely.
const AUTH_TIMEOUT_MS = 10_000

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

interface Connection {
  socket: WebSocket
  deviceId: string | null
  deviceName: string | null
  authTimer: ReturnType<typeof setTimeout> | null
}

function lanAddress(): string {
  for (const ifaceList of Object.values(networkInterfaces())) {
    for (const iface of ifaceList ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

function guessContentType(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Local network counterpart to `PcscService`: instead of owning a physical
 * reader, it owns a WSS server that paired Android phones connect to. Card
 * cryptography/IO happens entirely on the phone, so this class only ever
 * deals in already-decoded results — see `src/shared/remoteProtocol.ts`.
 */
export class RemoteService {
  private server: HttpsServer
  private wss: WebSocketServer
  private connections = new Set<Connection>()

  private constructor(
    private tls: TlsIdentity,
    private mainWindow: BrowserWindow,
    private getCardEventWindow: () => BrowserWindow
  ) {
    this.server = createServer({ key: tls.key, cert: tls.cert }, (req, res) => {
      void this.handleHttp(req, res)
    })
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' })
    this.wss.on('connection', (socket) => this.handleConnection(socket))
    this.server.on('error', (err) => console.error('[remote] server error', err))
    this.server.listen(REMOTE_PORT, '0.0.0.0', () => {
      console.log(`[remote] listening on wss://0.0.0.0:${REMOTE_PORT}/ws`)
    })
  }

  static async create(
    mainWindow: BrowserWindow,
    getCardEventWindow: () => BrowserWindow
  ): Promise<RemoteService> {
    const tls = await getTlsIdentity()
    return new RemoteService(tls, mainWindow, getCardEventWindow)
  }

  /** Opens a new pairing window and returns the QR/manual-entry payload. */
  startPairing(): PairingSession {
    const session = startPairingSession()
    const uri = buildPairingUri({
      host: lanAddress(),
      port: REMOTE_PORT,
      fingerprint: this.tls.fingerprint,
      code: session.code,
      expiresAt: session.expiresAt
    })
    return { uri, code: session.code, expiresAt: session.expiresAt }
  }

  cancelPairing(): void {
    cancelPairingSession()
  }

  listDevices(): PairedDeviceStatus[] {
    const connectedIds = new Set(
      [...this.connections].filter((c) => c.deviceId).map((c) => c.deviceId as string)
    )
    return listPairedDevices().map((d) => ({
      id: d.id,
      name: d.name,
      pairedAt: d.pairedAt,
      lastSeenAt: d.lastSeenAt,
      connected: connectedIds.has(d.id)
    }))
  }

  revokeDevice(id: string): void {
    for (const conn of this.connections) {
      if (conn.deviceId === id) {
        this.send(conn, { type: 'revoked' })
        conn.socket.close(4002, 'revoked')
      }
    }
    removeDevice(id)
    this.notifyDevicesChanged()
  }

  /** Pushes the current library to every authenticated, connected phone. */
  broadcastLibrary(games: Game[]): void {
    const message: PcToPhone = { type: 'library', games: this.remoteLibrary(games) }
    for (const conn of this.connections) {
      if (conn.deviceId) this.send(conn, message)
    }
  }

  destroy(): void {
    for (const conn of this.connections) conn.socket.terminate()
    this.wss.close()
    this.server.close()
  }

  /** Rewrites any PC-local `file://` art path into this server's `/art`
   * endpoint (unreachable from the phone otherwise); remote CDN URLs are
   * passed through unchanged so the phone fetches them directly. */
  private remoteLibrary(games: Game[]): Game[] {
    const host = lanAddress()
    const rewrite = (path: string | undefined, game: Game, variant: 'art' | 'artFallback'): string | undefined => {
      if (!path) return undefined
      if (!path.startsWith('file://')) return path
      const params = new URLSearchParams({ platform: game.platform, id: game.id, variant })
      return `https://${host}:${REMOTE_PORT}/art?${params.toString()}`
    }
    return games.map((g) => ({
      ...g,
      art: rewrite(g.art, g, 'art'),
      artFallback: rewrite(g.artFallback, g, 'artFallback')
    }))
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'https://localhost')
    if (url.pathname !== '/art') {
      res.writeHead(404).end()
      return
    }

    // /art only serves image bytes already available on the LAN via the
    // WebSocket library sync — no auth needed here. Leaving it open means
    // the phone can load art without sending auth headers, which is simpler
    // than fighting Coil 3 import issues for a custom OkHttp client.

    const platform = url.searchParams.get('platform')
    const id = url.searchParams.get('id')
    const variant = url.searchParams.get('variant') === 'artFallback' ? 'artFallback' : 'art'
    const game = platform && id ? findGame(platform as Game['platform'], id) : undefined
    const artPath = game?.[variant]

    if (!artPath || !artPath.startsWith('file://')) {
      res.writeHead(404).end()
      return
    }

    try {
      const data = await readFile(fileURLToPath(artPath))
      res.writeHead(200, { 'Content-Type': guessContentType(artPath) })
      res.end(data)
    } catch (err) {
      console.error('[remote] failed to stream art', err)
      res.writeHead(404).end()
    }
  }

  private handleConnection(socket: WebSocket): void {
    const conn: Connection = { socket, deviceId: null, deviceName: null, authTimer: null }
    conn.authTimer = setTimeout(() => {
      if (!conn.deviceId) socket.close(4001, 'auth timeout')
    }, AUTH_TIMEOUT_MS)
    this.connections.add(conn)

    socket.on('message', (raw) => this.handleMessage(conn, raw))
    socket.on('close', () => {
      this.connections.delete(conn)
      if (conn.authTimer) clearTimeout(conn.authTimer)
      if (conn.deviceId) this.notifyDevicesChanged()
    })
    socket.on('error', (err) => console.error('[remote] socket error', err))
  }

  private send(conn: Connection, message: PcToPhone): void {
    if (conn.socket.readyState === WebSocket.OPEN) conn.socket.send(JSON.stringify(message))
  }

  private handleMessage(conn: Connection, raw: RawData): void {
    let message: PhoneToPc
    try {
      message = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (message.type === 'pair') {
      this.handlePair(conn, message)
      return
    }

    if (message.type === 'auth') {
      this.handleAuth(conn, message)
      return
    }

    // Everything else requires an already-authenticated connection.
    if (!conn.deviceId) return

    switch (message.type) {
      case 'tap':
        this.handleRemoteTap(conn, message)
        break
      case 'programmed':
        this.sendCardEvent({
          type: 'remote-toast',
          message: `Programmed "${message.payload.title}" via ${conn.deviceName ?? 'a phone'}`
        })
        break
      case 'erased':
        this.sendCardEvent({
          type: 'remote-toast',
          message: `Erased "${message.payload.title}" via ${conn.deviceName ?? 'a phone'}`
        })
        break
      case 'ping':
        this.send(conn, { type: 'pong' })
        break
    }
  }

  private handlePair(conn: Connection, message: Extract<PhoneToPc, { type: 'pair' }>): void {
    if (!consumePairingCode(message.code)) {
      this.send(conn, { type: 'pairFailed', reason: 'Invalid or expired code' })
      return
    }

    const { device, token } = addDevice(message.deviceName || 'Phone')
    conn.deviceId = device.id
    conn.deviceName = device.name
    if (conn.authTimer) clearTimeout(conn.authTimer)

    this.send(conn, { type: 'paired', deviceId: device.id, token, pcName: hostname() })
    this.send(conn, { type: 'library', games: this.remoteLibrary(getLibrary()) })
    this.notifyDevicesChanged()
  }

  private handleAuth(conn: Connection, message: Extract<PhoneToPc, { type: 'auth' }>): void {
    const device = verifyDevice(message.deviceId, message.token)
    if (!device) {
      this.send(conn, { type: 'authResult', ok: false, reason: 'Unknown device' })
      return
    }

    conn.deviceId = device.id
    conn.deviceName = device.name
    if (conn.authTimer) clearTimeout(conn.authTimer)

    this.send(conn, { type: 'authResult', ok: true })
    this.send(conn, { type: 'library', games: this.remoteLibrary(getLibrary()) })
    this.notifyDevicesChanged()
  }

  /** Resolves the tap against the local library exactly like `PcscService.handleTap`
   * does for a physical reader, then feeds it through the same `card:event`
   * channel — the renderer's existing reveal/countdown/launch UI doesn't need
   * to know or care that this tap came from a phone instead of the USB reader. */
  private handleRemoteTap(conn: Connection, message: Extract<PhoneToPc, { type: 'tap' }>): void {
    const { uid, result } = message
    const localMatch = result.kind === 'data' ? findGame(result.payload.platform, result.payload.id) : undefined
    const tap: CardTapEvent = { uid, result, localMatch }

    this.send(conn, { type: 'tapResult', tap })
    this.sendCardEvent({ type: 'tap', tap })
  }

  private sendCardEvent(event: CardEventFromMain): void {
    this.getCardEventWindow().webContents.send(IPC.cardEvent, event)
  }

  private notifyDevicesChanged(): void {
    this.mainWindow.webContents.send(IPC.phoneDevicesChanged, this.listDevices())
  }
}
