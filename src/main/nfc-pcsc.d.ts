declare module 'nfc-pcsc' {
  import { EventEmitter } from 'events'

  export interface Card {
    uid: string
    atr?: Buffer
    type?: string
    standard?: string
  }

  export class Reader extends EventEmitter {
    name: string
    autoProcessing: boolean
    authenticate(blockNumber: number, keyType: number, key: string | Buffer): Promise<void>
    read(blockNumber: number, length: number, blockSize?: number, packetSize?: number): Promise<Buffer>
    write(blockNumber: number, data: Buffer, blockSize?: number): Promise<void>
  }

  export class NFC extends EventEmitter {
    constructor()
    close(): void
  }

  export const KEY_TYPE_A: number
  export const KEY_TYPE_B: number
}
