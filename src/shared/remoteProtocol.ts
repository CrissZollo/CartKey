import type { CardPayload, CardReadResult, CardTapEvent, Game } from './types'

/**
 * JSON message contract for the WebSocket link between the desktop app and a
 * paired Android device (see src/main/remote/remoteServer.ts). There's no
 * shared codegen across the TS/Kotlin boundary — net/Protocol.kt on the
 * Android side mirrors this by hand, so keep the two in sync manually.
 *
 * Card cryptography/IO happens entirely on the phone (it has its own NFC
 * reader), so the PC only ever needs the decoded result of a tap, never raw
 * card bytes.
 */
export type PhoneToPc =
  | { type: 'pair'; code: string; deviceName: string }
  | { type: 'auth'; deviceId: string; token: string }
  | { type: 'tap'; uid: string; result: CardReadResult }
  | { type: 'programmed'; payload: CardPayload }
  | { type: 'erased'; payload: CardPayload }
  | { type: 'ping' }

export type PcToPhone =
  | { type: 'paired'; deviceId: string; token: string; pcName: string }
  | { type: 'pairFailed'; reason: string }
  | { type: 'authResult'; ok: boolean; reason?: string }
  | { type: 'library'; games: Game[] }
  | { type: 'tapResult'; tap: CardTapEvent }
  | { type: 'revoked' }
  | { type: 'pong' }

const PAIRING_SCHEME = 'cartkey:'
const PAIRING_HOST = 'pair'

export interface PairingPayload {
  host: string
  port: number
  fingerprint: string
  code: string
  expiresAt: number
}

/** What the desktop's pairing QR encodes — a `cartkey://pair` deep link so a
 * stock camera app's QR handler can also jump straight into the Android app,
 * not just this app's own in-app scanner. */
export function buildPairingUri(payload: PairingPayload): string {
  const params = new URLSearchParams({
    host: payload.host,
    port: String(payload.port),
    fp: payload.fingerprint,
    code: payload.code,
    exp: String(payload.expiresAt)
  })
  return `${PAIRING_SCHEME}//${PAIRING_HOST}?${params.toString()}`
}
