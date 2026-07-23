export type Platform = 'steam' | 'gog'

export interface Game {
  platform: Platform
  id: string
  title: string
  /** file:// path if art is cached locally, otherwise a remote https url, otherwise undefined */
  art?: string
  /** tried if `art` fails to load (e.g. a guessed CDN url that 404s) */
  artFallback?: string
  installed: boolean
}

export interface CardPayload {
  version: 1
  platform: Platform
  id: string
  title: string
  artUrl?: string
}

export type ReaderStatus =
  | { state: 'no-reader' }
  | { state: 'idle'; readerName: string }
  | { state: 'card-present'; readerName: string; uid: string }

export type CardReadResult =
  | { kind: 'empty' }
  | { kind: 'unreadable' }
  | { kind: 'data'; payload: CardPayload }

export interface CardTapEvent {
  uid: string
  result: CardReadResult
  /** resolved against the local library, when the card's game is known and matches an installed game here */
  localMatch?: Game
}

export type WriteOutcome =
  | { ok: true }
  | { ok: false; error: string }

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'downloading'; version: string }
  | { state: 'ready'; version: string; releaseNotes: string }

/** A currently-open pairing window, as shown to the renderer for QR/manual display. */
export interface PairingSession {
  uri: string
  code: string
  expiresAt: number
}

/** A previously-paired phone, as shown to the renderer (never carries the token/hash). */
export interface PairedDeviceStatus {
  id: string
  name: string
  pairedAt: number
  lastSeenAt: number
  connected: boolean
}
