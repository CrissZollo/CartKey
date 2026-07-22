import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Platform } from '@shared/types'
import { useAppStore } from '../lib/store'

interface Reveal {
  platform: Platform
  id: string
  title: string
  art?: string
  artFallback?: string
  installedHere: boolean
}

const PLATFORM_LABEL: Record<Platform, string> = { steam: 'Steam', gog: 'GOG' }

const COUNTDOWN_START = 3

export function ScanOverlay() {
  const cardEvent = useAppStore((s) => s.cardEvent)
  const programModalOpen = useAppStore((s) => s.programModalOpen)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [count, setCount] = useState(COUNTDOWN_START)
  const [artAttempt, setArtAttempt] = useState(0)
  const launchedRef = useRef(false)
  const artCandidates = useMemo(
    () => (reveal ? [reveal.art, reveal.artFallback].filter((x): x is string => !!x) : []),
    [reveal]
  )
  const artSrc = artCandidates[artAttempt]

  useEffect(() => setArtAttempt(0), [reveal])

  useEffect(() => {
    if (!cardEvent || programModalOpen) return

    if (cardEvent.type === 'tap') {
      const { result, localMatch } = cardEvent.tap
      if (result.kind === 'empty') {
        setToast('Blank card — pick a game in your library to program it')
      } else if (result.kind === 'unreadable') {
        setToast("Couldn't read that card")
      } else if (result.kind === 'data') {
        launchedRef.current = false
        setCount(COUNTDOWN_START)
        setReveal({
          platform: localMatch?.platform ?? result.payload.platform,
          id: localMatch?.id ?? result.payload.id,
          title: localMatch?.title ?? result.payload.title,
          art: localMatch?.art ?? result.payload.artUrl,
          artFallback: localMatch?.artFallback,
          installedHere: !!localMatch
        })
      }
    } else if (cardEvent.type === 'card-removed') {
      setReveal(null)
    }
  }, [cardEvent, programModalOpen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!reveal || !reveal.installedHere) return undefined
    if (count <= 0) {
      if (!launchedRef.current) {
        launchedRef.current = true
        void window.api.launch({ platform: reveal.platform, id: reveal.id })
        setTimeout(() => setReveal(null), 550)
      }
      return undefined
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1200)
    return () => clearTimeout(t)
  }, [reveal, count])

  return (
    <>
      <AnimatePresence>
        {reveal && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={launchedRef.current ? { opacity: 0, scale: 1.15 } : { opacity: 0 }}
            transition={{ duration: 0.7 }}
            onClick={() => setReveal(null)}
          >
            <motion.div
              className="h-80 w-56 overflow-hidden rounded-2xl shadow-2xl shadow-black/70"
              initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
              animate={{ scale: [0.4, 1.08, 1], opacity: 1, rotate: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            >
              {artSrc ? (
                <img
                  src={artSrc}
                  alt={reveal.title}
                  onError={() => setArtAttempt((a) => a + 1)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-ink-soft p-4 text-center font-semibold">
                  {reveal.title}
                </div>
              )}
            </motion.div>

            <motion.div
              className="mt-6 flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
            >
              <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold tracking-wide uppercase">
                {PLATFORM_LABEL[reveal.platform]}
              </span>
              <h2 className="text-2xl font-bold">{reveal.title}</h2>

              {reveal.installedHere ? (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={count}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mt-2 text-sm text-white/60"
                  >
                    {count > 0 ? `Launching in ${count}…` : 'Launching!'}
                  </motion.p>
                </AnimatePresence>
              ) : (
                <p className="mt-2 text-sm text-white/50">Not installed on this computer</p>
              )}

              <p className="mt-4 text-xs text-white/30">
                {reveal.installedHere ? 'Click anywhere to cancel' : 'Click anywhere to dismiss'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white/10 px-5 py-2.5 text-sm text-white/85 backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
