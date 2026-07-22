import { useEffect } from 'react'
import { useAppStore } from './store'

/** Subscribes once to the main process's reader/card event streams and mirrors them into the store. */
export function useCardBridge(): void {
  const setReaderStatus = useAppStore((s) => s.setReaderStatus)
  const pushCardEvent = useAppStore((s) => s.pushCardEvent)

  useEffect(() => {
    const unsubStatus = window.api.reader.onStatus(setReaderStatus)
    const unsubEvent = window.api.card.onEvent(pushCardEvent)
    // The reader may already have connected before this listener was attached
    // (e.g. while the page was still loading) — pull the current state once
    // so we don't get stuck showing "no reader" forever.
    void window.api.reader.getStatus().then(setReaderStatus)
    return () => {
      unsubStatus()
      unsubEvent()
    }
  }, [setReaderStatus, pushCardEvent])
}
