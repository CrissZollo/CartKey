import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type CardEventFromMain } from '../shared/ipc'
import type { CardPayload, Game, ReaderStatus } from '../shared/types'

const api = {
  library: {
    list: (): Promise<Game[]> => ipcRenderer.invoke(IPC.libraryList),
    refresh: (): Promise<Game[]> => ipcRenderer.invoke(IPC.libraryRefresh)
  },
  launch: (game: Pick<Game, 'platform' | 'id'>): Promise<void> => ipcRenderer.invoke(IPC.launch, game),
  card: {
    beginProgram: (payload: CardPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.cardBeginProgram, payload),
    cancelProgram: (): Promise<void> => ipcRenderer.invoke(IPC.cardCancelProgram),
    confirmOverwrite: (): Promise<void> => ipcRenderer.invoke(IPC.cardConfirmOverwrite),
    onEvent: (cb: (event: CardEventFromMain) => void): (() => void) => {
      const listener = (_event: unknown, payload: CardEventFromMain): void => cb(payload)
      ipcRenderer.on(IPC.cardEvent, listener)
      return () => ipcRenderer.removeListener(IPC.cardEvent, listener)
    }
  },
  reader: {
    getStatus: (): Promise<ReaderStatus> => ipcRenderer.invoke(IPC.readerGetStatus),
    onStatus: (cb: (status: ReaderStatus) => void): (() => void) => {
      const listener = (_event: unknown, status: ReaderStatus): void => cb(status)
      ipcRenderer.on(IPC.readerStatus, listener)
      return () => ipcRenderer.removeListener(IPC.readerStatus, listener)
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
