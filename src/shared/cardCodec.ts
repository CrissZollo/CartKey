import type { CardPayload, Platform } from './types'

/** Mifare Classic 1K layout: 16 sectors x 4 blocks x 16 bytes. Sector 0 holds
 * manufacturer data (never touched); the last block of every sector is the
 * sector trailer (keys/access bits, never usable for data). */
const SECTORS = 16
const BLOCKS_PER_SECTOR = 4
export const BLOCK_SIZE = 16

/** Absolute block numbers safe to read/write data into, in write order. */
export function dataBlockNumbers(): number[] {
  const blocks: number[] = []
  for (let sector = 1; sector < SECTORS; sector++) {
    for (let block = 0; block < BLOCKS_PER_SECTOR - 1; block++) {
      blocks.push(sector * BLOCKS_PER_SECTOR + block)
    }
  }
  return blocks
}

export const CARD_CAPACITY_BYTES = dataBlockNumbers().length * BLOCK_SIZE // 720

const MAGIC = 0xca
const VERSION = 1
const PLATFORM_CODES: Record<Platform, number> = { steam: 0, gog: 1 }
const PLATFORM_FROM_CODE: Record<number, Platform> = { 0: 'steam', 1: 'gog' }

const MAX_ID_BYTES = 48
const MAX_TITLE_BYTES = 64
const MAX_ART_URL_BYTES = 200

function truncateUtf8(input: string, maxBytes: number): Buffer {
  let buf = Buffer.from(input, 'utf8')
  while (buf.length > maxBytes) {
    input = input.slice(0, -1)
    buf = Buffer.from(input, 'utf8')
  }
  return buf
}

/** Clamp a payload's variable-length fields so it is guaranteed to fit on the card. */
export function fitPayload(payload: CardPayload): CardPayload {
  return {
    version: 1,
    platform: payload.platform,
    id: truncateUtf8(payload.id, MAX_ID_BYTES).toString('utf8'),
    title: truncateUtf8(payload.title, MAX_TITLE_BYTES).toString('utf8'),
    artUrl: payload.artUrl ? truncateUtf8(payload.artUrl, MAX_ART_URL_BYTES).toString('utf8') : undefined
  }
}

/** Encode a payload into a full CARD_CAPACITY_BYTES buffer, zero-padded. */
export function encodeCardPayload(rawPayload: CardPayload): Buffer {
  const payload = fitPayload(rawPayload)
  const idBuf = Buffer.from(payload.id, 'utf8')
  const titleBuf = Buffer.from(payload.title, 'utf8')
  const artUrlBuf = payload.artUrl ? Buffer.from(payload.artUrl, 'utf8') : Buffer.alloc(0)

  const body = Buffer.concat([
    Buffer.from([MAGIC, VERSION, PLATFORM_CODES[payload.platform]]),
    Buffer.from([idBuf.length]),
    idBuf,
    Buffer.from([titleBuf.length]),
    titleBuf,
    Buffer.from([artUrlBuf.length]),
    artUrlBuf
  ])

  if (body.length > CARD_CAPACITY_BYTES) {
    throw new Error(`Encoded payload (${body.length}B) exceeds card capacity (${CARD_CAPACITY_BYTES}B)`)
  }

  const out = Buffer.alloc(CARD_CAPACITY_BYTES)
  body.copy(out)
  return out
}

/** Decode a full card dump back into a payload. Returns null for blank/foreign cards. */
export function decodeCardPayload(data: Buffer): CardPayload | null {
  if (data.length < 4 || data[0] !== MAGIC || data[1] !== VERSION) return null
  const platform = PLATFORM_FROM_CODE[data[2]]
  if (!platform) return null

  let offset = 3
  const readField = (): string | null => {
    if (offset >= data.length) return null
    const len = data[offset]
    offset += 1
    if (offset + len > data.length) return null
    const str = data.subarray(offset, offset + len).toString('utf8')
    offset += len
    return str
  }

  const id = readField()
  if (id === null) return null
  const title = readField()
  if (title === null) return null
  const artUrl = readField()

  return { version: 1, platform, id, title, artUrl: artUrl || undefined }
}
