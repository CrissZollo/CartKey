import { NFC, KEY_TYPE_A, type Reader, type Card } from 'nfc-pcsc'
import type { BrowserWindow } from 'electron'
import { BLOCK_SIZE, CARD_CAPACITY_BYTES, decodeCardPayload, encodeCardPayload } from '../shared/cardCodec'
import type { CardPayload, ReaderStatus } from '../shared/types'
import { IPC, type CardEventFromMain } from '../shared/ipc'
import { findGame } from './library'

const DEFAULT_KEY = 'FFFFFFFFFFFF'
const SECTORS = 16
const DATA_BLOCKS_PER_SECTOR = 3
// How often to retry establishing a PC/SC context while no reader is present.
// Owning this loop means unplug/replug, pcscd restarting, or a stale context
// all self-heal without restarting the app.
const RECONNECT_INTERVAL_MS = 5000

type Mode = { kind: 'idle' } | { kind: 'awaiting-write'; payload: CardPayload } | { kind: 'awaiting-erase' }

interface PendingConfirmation {
  reader: Reader
  newPayload: CardPayload
}

export class PcscService {
  private nfc: NFC | null = null
  private mode: Mode = { kind: 'idle' }
  private pendingConfirmation: PendingConfirmation | null = null
  private currentStatus: ReaderStatus = { state: 'no-reader' }
  private supervisorTimer: ReturnType<typeof setInterval> | null = null

  /**
   * `mainWindow` always gets reader status (harmless to send to a hidden
   * window, and means the pill is already correct whenever it's reopened).
   * `getCardEventWindow` decides who should react to an actual card event —
   * the library window if it's open, otherwise a callback-provided fallback
   * (e.g. a fullscreen toast window) so taps still do something useful while
   * the app is just sitting quietly in the tray.
   */
  constructor(
    private mainWindow: BrowserWindow,
    private getCardEventWindow: () => BrowserWindow
  ) {
    this.connect()
    this.supervisorTimer = setInterval(() => {
      if (this.currentStatus.state === 'no-reader') this.connect()
    }, RECONNECT_INTERVAL_MS)
  }

  getStatus(): ReaderStatus {
    return this.currentStatus
  }

  beginProgram(payload: CardPayload): void {
    this.mode = { kind: 'awaiting-write', payload }
  }

  beginErase(): void {
    this.mode = { kind: 'awaiting-erase' }
  }

  /** Cancels whatever card operation is currently armed (program or erase). */
  cancelProgram(): void {
    this.mode = { kind: 'idle' }
    this.pendingConfirmation = null
  }

  /** User confirmed overwriting the card that was already carrying a different game. */
  async confirmOverwrite(): Promise<void> {
    if (!this.pendingConfirmation) return
    const { reader, newPayload } = this.pendingConfirmation
    this.pendingConfirmation = null
    this.mode = { kind: 'idle' }
    await this.handleWrite(reader, newPayload)
  }

  /** Releases the PC/SC context and stops retrying. Call when the app quits. */
  destroy(): void {
    if (this.supervisorTimer) clearInterval(this.supervisorTimer)
    this.supervisorTimer = null
    this.teardown()
  }

  /** (Re)establishes the PC/SC context from scratch. Safe to call repeatedly. */
  private connect(): void {
    this.teardown()

    const nfc = new NFC()
    this.nfc = nfc

    nfc.on('reader', (reader) => this.handleReader(reader))
    nfc.on('error', (err) => {
      console.error('[pcsc] nfc error', err)
      this.teardown()
      this.sendReaderStatus({ state: 'no-reader' })
    })
  }

  private teardown(): void {
    if (!this.nfc) return
    try {
      this.nfc.close()
    } catch {
      // already gone
    }
    this.nfc.removeAllListeners()
    this.nfc = null
  }

  private handleReader(reader: Reader): void {
    reader.autoProcessing = false
    const readerName = reader.name

    this.sendReaderStatus({ state: 'idle', readerName })

    reader.on('card', async (card: Card) => {
      this.sendReaderStatus({ state: 'card-present', readerName, uid: card.uid })
      if (this.mode.kind === 'awaiting-write') {
        await this.handleProgramTap(reader, this.mode.payload)
      } else if (this.mode.kind === 'awaiting-erase') {
        await this.handleEraseTap(reader)
      } else {
        await this.handleTap(reader, card.uid)
      }
    })

    reader.on('card.off', () => {
      this.sendReaderStatus({ state: 'idle', readerName })
      this.pendingConfirmation = null
      this.sendCardEvent({ type: 'card-removed' })
    })

    reader.on('error', (err: Error) => console.error('[pcsc] reader error', err))

    reader.on('end', () => {
      // Physically unplugged (or pcscd dropped it). Tear the whole context
      // down rather than trusting it to notice a replug on its own — the
      // supervisor interval will re-establish it shortly.
      this.teardown()
      this.sendReaderStatus({ state: 'no-reader' })
    })
  }

  private async readAllBlocks(reader: Reader): Promise<Buffer | null> {
    const chunks: Buffer[] = []
    try {
      for (let sector = 1; sector < SECTORS; sector++) {
        const sectorFirstBlock = sector * 4
        await reader.authenticate(sectorFirstBlock, KEY_TYPE_A, DEFAULT_KEY)
        for (let b = 0; b < DATA_BLOCKS_PER_SECTOR; b++) {
          chunks.push(await reader.read(sectorFirstBlock + b, BLOCK_SIZE, BLOCK_SIZE))
        }
      }
    } catch (err) {
      console.error('[pcsc] read failed', err)
      return null
    }
    return Buffer.concat(chunks)
  }

  private async handleTap(reader: Reader, uid: string): Promise<void> {
    const raw = await this.readAllBlocks(reader)
    if (!raw) {
      this.sendCardEvent({ type: 'tap', tap: { uid, result: { kind: 'unreadable' } } })
      return
    }
    const payload = decodeCardPayload(raw)
    if (!payload) {
      this.sendCardEvent({ type: 'tap', tap: { uid, result: { kind: 'empty' } } })
      return
    }
    const localMatch = findGame(payload.platform, payload.id)
    this.sendCardEvent({ type: 'tap', tap: { uid, result: { kind: 'data', payload }, localMatch } })
  }

  /** Card tapped while armed to program. Checks for an existing game on the
   * card first — if there is one, pause for the user's explicit confirmation
   * instead of silently overwriting it. */
  private async handleProgramTap(reader: Reader, newPayload: CardPayload): Promise<void> {
    const raw = await this.readAllBlocks(reader)
    const existing = raw ? decodeCardPayload(raw) : null

    if (existing) {
      if (existing.platform === newPayload.platform && existing.id === newPayload.id) {
        this.sendCardEvent({ type: 'already-loaded', existing })
        return
      }
      this.pendingConfirmation = { reader, newPayload }
      const existingLocalMatch = findGame(existing.platform, existing.id)
      this.sendCardEvent({ type: 'confirm-overwrite', existing, existingLocalMatch })
      return
    }

    this.mode = { kind: 'idle' }
    await this.handleWrite(reader, newPayload)
  }

  /** Writes a full CARD_CAPACITY_BYTES buffer across sectors 1-15, authenticating each sector first. */
  private async writeAllBlocks(reader: Reader, buffer: Buffer): Promise<void> {
    let offset = 0
    for (let sector = 1; sector < SECTORS; sector++) {
      const sectorFirstBlock = sector * 4
      await reader.authenticate(sectorFirstBlock, KEY_TYPE_A, DEFAULT_KEY)
      for (let b = 0; b < DATA_BLOCKS_PER_SECTOR; b++) {
        const chunk = buffer.subarray(offset, offset + BLOCK_SIZE)
        await reader.write(sectorFirstBlock + b, chunk, BLOCK_SIZE)
        offset += BLOCK_SIZE
      }
    }
  }

  private async handleWrite(reader: Reader, payload: CardPayload): Promise<void> {
    this.sendCardEvent({ type: 'write-start' })
    try {
      await this.writeAllBlocks(reader, encodeCardPayload(payload))
      this.sendCardEvent({ type: 'write-result', outcome: { ok: true } })
    } catch (err) {
      this.sendCardEvent({
        type: 'write-result',
        outcome: { ok: false, error: (err as Error).message }
      })
    }
  }

  /** Card tapped while armed to erase. A blank/already-empty card is reported
   * as a no-op; otherwise the existing game is reported (so the UI can play
   * the "sucked into the void" animation over its art) and then wiped. */
  private async handleEraseTap(reader: Reader): Promise<void> {
    this.mode = { kind: 'idle' }
    const raw = await this.readAllBlocks(reader)
    const existing = raw ? decodeCardPayload(raw) : null

    if (!existing) {
      this.sendCardEvent({ type: 'erase-empty' })
      return
    }

    const existingLocalMatch = findGame(existing.platform, existing.id)
    this.sendCardEvent({ type: 'erase-start', existing, existingLocalMatch })

    try {
      await this.writeAllBlocks(reader, Buffer.alloc(CARD_CAPACITY_BYTES))
      this.sendCardEvent({ type: 'erase-result', outcome: { ok: true } })
    } catch (err) {
      this.sendCardEvent({
        type: 'erase-result',
        outcome: { ok: false, error: (err as Error).message }
      })
    }
  }

  private sendCardEvent(event: CardEventFromMain): void {
    this.getCardEventWindow().webContents.send(IPC.cardEvent, event)
  }

  private sendReaderStatus(status: ReaderStatus): void {
    this.currentStatus = status
    this.mainWindow.webContents.send(IPC.readerStatus, status)
  }
}
