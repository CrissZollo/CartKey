import type { CardPayload, CardTapEvent, Game, ReaderStatus, WriteOutcome } from './types'

export const IPC = {
  libraryList: 'library:list',
  libraryRefresh: 'library:refresh',
  launch: 'launch',
  cardBeginProgram: 'card:beginProgram',
  cardCancelProgram: 'card:cancelProgram',
  cardConfirmOverwrite: 'card:confirmOverwrite',
  cardEvent: 'card:event',
  readerStatus: 'reader:status',
  readerGetStatus: 'reader:getStatus',
  updateStatus: 'update:status',
  updateGetStatus: 'update:getStatus',
  updateCheck: 'update:check',
  updateInstall: 'update:install'
} as const

export type CardEventFromMain =
  | { type: 'tap'; tap: CardTapEvent }
  | { type: 'already-loaded'; existing: CardPayload }
  | { type: 'confirm-overwrite'; existing: CardPayload; existingLocalMatch?: Game }
  | { type: 'write-start' }
  | { type: 'write-result'; outcome: WriteOutcome }
  | { type: 'card-removed' }

export type { ReaderStatus }
