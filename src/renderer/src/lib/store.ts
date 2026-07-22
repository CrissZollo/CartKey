import { create } from 'zustand'
import type { CardEventFromMain } from '@shared/ipc'
import type { Game, ReaderStatus } from '@shared/types'

interface AppState {
  games: Game[]
  loadingLibrary: boolean
  readerStatus: ReaderStatus
  cardEvent: CardEventFromMain | null
  cardEventSeq: number
  programModalOpen: boolean

  setGames: (games: Game[]) => void
  setLoadingLibrary: (loading: boolean) => void
  setReaderStatus: (status: ReaderStatus) => void
  pushCardEvent: (event: CardEventFromMain) => void
  setProgramModalOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  games: [],
  loadingLibrary: true,
  readerStatus: { state: 'no-reader' },
  cardEvent: null,
  cardEventSeq: 0,
  programModalOpen: false,

  setGames: (games) => set({ games }),
  setLoadingLibrary: (loading) => set({ loadingLibrary: loading }),
  setReaderStatus: (status) => set({ readerStatus: status }),
  pushCardEvent: (event) => set((s) => ({ cardEvent: event, cardEventSeq: s.cardEventSeq + 1 })),
  setProgramModalOpen: (open) => set({ programModalOpen: open })
}))
