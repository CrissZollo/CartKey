import type {
  CardPayload,
  CardTapEvent,
  Game,
  PairedDeviceStatus,
  PairingSession,
  ReaderStatus,
  WriteOutcome
} from './types'

export const IPC = {
  libraryList: 'library:list',
  libraryRefresh: 'library:refresh',
  launch: 'launch',
  cardBeginProgram: 'card:beginProgram',
  cardBeginErase: 'card:beginErase',
  cardCancelProgram: 'card:cancelProgram',
  cardConfirmOverwrite: 'card:confirmOverwrite',
  cardEvent: 'card:event',
  readerStatus: 'reader:status',
  readerGetStatus: 'reader:getStatus',
  updateStatus: 'update:status',
  updateGetStatus: 'update:getStatus',
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  phoneStartPairing: 'phone:startPairing',
  phoneCancelPairing: 'phone:cancelPairing',
  phoneListDevices: 'phone:listDevices',
  phoneRevokeDevice: 'phone:revokeDevice',
  phoneDevicesChanged: 'phone:devicesChanged',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set'
} as const

export type CardEventFromMain =
  | { type: 'tap'; tap: CardTapEvent }
  | { type: 'already-loaded'; existing: CardPayload }
  | { type: 'confirm-overwrite'; existing: CardPayload; existingLocalMatch?: Game }
  | { type: 'write-start' }
  | { type: 'write-result'; outcome: WriteOutcome }
  | { type: 'erase-empty' }
  | { type: 'erase-start'; existing: CardPayload; existingLocalMatch?: Game }
  | { type: 'erase-result'; outcome: WriteOutcome }
  | { type: 'card-removed' }
  | { type: 'remote-toast'; message: string }

export type { PairedDeviceStatus, PairingSession, ReaderStatus }
