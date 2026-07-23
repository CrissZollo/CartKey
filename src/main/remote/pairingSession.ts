import { randomBytes } from 'crypto'

// Long enough for a user to open the phone app and scan without feeling
// rushed, short enough that a stale QR left on screen isn't a standing risk.
const PAIRING_TTL_MS = 5 * 60 * 1000

// No 0/O/1/I — avoids ambiguity for the manual-entry fallback.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export interface ActivePairingSession {
  code: string
  expiresAt: number
}

let active: ActivePairingSession | null = null

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

export function startPairingSession(): ActivePairingSession {
  active = { code: randomCode(), expiresAt: Date.now() + PAIRING_TTL_MS }
  return active
}

export function cancelPairingSession(): void {
  active = null
}

export function getActivePairingSession(): ActivePairingSession | null {
  if (active && Date.now() > active.expiresAt) active = null
  return active
}

/** Single-use: consumes the session only if the code matches, so a wrong
 *  guess doesn't waste an active session (and a double-scan of the correct
 *  code on the second frame still fails cleanly because the first already
 *  consumed it). */
export function consumePairingCode(code: string): boolean {
  const session = getActivePairingSession()
  if (!session) return false
  if (session.code !== code) return false
  active = null
  return true
}
