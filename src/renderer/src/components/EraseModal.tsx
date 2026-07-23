import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WriteOutcome } from '@shared/types'
import { useAppStore } from '../lib/store'
import {
  BOX_HEIGHT,
  BOX_WIDTH,
  DISSOLVE_EASE,
  DISSOLVE_GRID,
  TILE_TRAVEL_DURATION,
  useCoverFit,
  useDissolveTiles
} from '../lib/dissolveTiles'

type Phase = 'armed' | 'already-empty' | 'voiding' | 'processing' | 'success' | 'error'

interface ExistingCardInfo {
  title: string
  art?: string
  artFallback?: string
}

// The real card wipe is fast enough to finish before the user has even looked
// up from placing the card — hold each phase for at least this long
// regardless of how quickly the hardware actually responds, so the animation
// is never skipped past. Matches ProgramModal's pacing for a consistent feel.
const MIN_VOIDING_MS = 1750
const MIN_PROCESSING_MS = 1400

export function EraseModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('armed')
  const [errorMessage, setErrorMessage] = useState('')
  const cardEvent = useAppStore((s) => s.cardEvent)
  const setEraseModalOpen = useAppStore((s) => s.setEraseModalOpen)
  const [existingInfo, setExistingInfo] = useState<ExistingCardInfo | null>(null)
  const artCandidates = useMemo(
    () => [existingInfo?.art, existingInfo?.artFallback].filter((x): x is string => !!x),
    [existingInfo]
  )
  const [artAttempt, setArtAttempt] = useState(0)
  const artSrc = artCandidates[artAttempt]
  const coverFit = useCoverFit(artSrc)
  const dissolving = phase === 'voiding' || phase === 'processing' || phase === 'success' || phase === 'error'
  // 'out': the poster is sucked up and away into nothing, rather than down into the card.
  const tiles = useDissolveTiles(dissolving, 'out')
  const [justLanded, setJustLanded] = useState(false)
  const pendingOutcomeRef = useRef<WriteOutcome | null>(null)
  const minProcessingElapsedRef = useRef(false)

  useEffect(() => setArtAttempt(0), [existingInfo])

  function revealIfReady(): void {
    if (!minProcessingElapsedRef.current || !pendingOutcomeRef.current) return
    const outcome = pendingOutcomeRef.current
    if (outcome.ok) {
      setPhase('success')
    } else {
      setErrorMessage(outcome.error)
      setPhase('error')
    }
  }

  useEffect(() => {
    setEraseModalOpen(true)
    void window.api.card.beginErase()
    return () => {
      setEraseModalOpen(false)
      void window.api.card.cancelProgram()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!cardEvent) return
    if (cardEvent.type === 'erase-empty') {
      setPhase('already-empty')
    } else if (cardEvent.type === 'erase-start') {
      const { existing, existingLocalMatch } = cardEvent
      setExistingInfo({
        title: existingLocalMatch?.title ?? existing.title,
        art: existingLocalMatch?.art ?? existing.artUrl,
        artFallback: existingLocalMatch?.artFallback
      })
      pendingOutcomeRef.current = null
      minProcessingElapsedRef.current = false
      setPhase('voiding')
    } else if (cardEvent.type === 'erase-result') {
      // The real wipe often finishes almost instantly — store the result and
      // only reveal it once the animation has actually had time to play.
      pendingOutcomeRef.current = cardEvent.outcome
      revealIfReady()
    } else if (cardEvent.type === 'card-removed' && phase === 'already-empty') {
      // User lifted the card instead of trying another one — dismiss gesture.
      setPhase('armed')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardEvent])

  useEffect(() => {
    if (phase === 'voiding') {
      const t = setTimeout(() => setPhase('processing'), MIN_VOIDING_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'processing') {
      const t = setTimeout(() => {
        minProcessingElapsedRef.current = true
        revealIfReady()
      }, MIN_PROCESSING_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'success') {
      const t = setTimeout(onClose, 2600)
      return () => clearTimeout(t)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, onClose])

  useEffect(() => {
    if (phase !== 'processing') return undefined
    // The dissolve just finished pouring out of the card — a heavy "thud" as
    // the wipe lands, before settling into the ongoing writing pulse.
    setJustLanded(true)
    const t = setTimeout(() => setJustLanded(false), 500)
    return () => clearTimeout(t)
  }, [phase])

  const promptText: Record<Phase, string> = {
    armed: 'Tap the card you want to erase',
    'already-empty': 'This card is already empty',
    voiding: 'Reading card…',
    processing: 'Erasing card…',
    success: 'Card erased!',
    error: errorMessage || 'Something went wrong'
  }

  const dismissable = phase === 'armed' || phase === 'already-empty'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={dismissable ? onClose : undefined}
    >
      <div className="relative flex flex-col items-center gap-8" onClick={(e) => e.stopPropagation()}>
        <div
          className={`relative h-72 w-52 shadow-2xl shadow-black/60 ${
            dissolving ? 'overflow-visible' : 'overflow-hidden rounded-2xl border-2 border-dashed border-white/15'
          }`}
        >
          {dissolving && coverFit ? (
            <div className="absolute inset-0">
              {tiles.map((t) => (
                <motion.div
                  key={`${t.row}-${t.col}`}
                  className="absolute"
                  style={{
                    left: t.left,
                    top: t.top,
                    width: BOX_WIDTH / DISSOLVE_GRID.cols,
                    height: BOX_HEIGHT / DISSOLVE_GRID.rows,
                    backgroundImage: artSrc ? `url("${artSrc}")` : undefined,
                    backgroundSize: `${coverFit.width}px ${coverFit.height}px`,
                    backgroundPosition: `${-(coverFit.offsetX + t.left)}px ${-(coverFit.offsetY + t.top)}px`
                  }}
                  initial={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
                  animate={{
                    opacity: [1, 1, 0.9, 0],
                    y: t.travelDistance,
                    x: t.driftX,
                    rotate: t.rotate,
                    scale: [1, 0.85, 0.4, 0.1]
                  }}
                  transition={{
                    duration: TILE_TRAVEL_DURATION,
                    delay: t.delay,
                    times: [0, 0.2, 0.7, 1],
                    ease: DISSOLVE_EASE
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm font-medium text-white/30">
              {phase === 'already-empty' ? 'Nothing on this card' : 'Tap a card to see what’s on it'}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="flex h-16 w-24 items-center justify-center rounded-lg border-2 border-white/30 bg-white/5"
            animate={
              phase === 'error'
                ? { x: [0, -10, 10, -8, 8, 0], borderColor: 'rgba(239,68,68,0.9)' }
                : phase === 'success'
                  ? { scale: [1, 1.15, 1], borderColor: 'rgba(34,197,94,0.9)' }
                  : phase === 'already-empty'
                    ? { scale: [1, 1.08, 1], borderColor: 'rgba(148,163,184,0.9)' }
                    : phase === 'processing'
                      ? justLanded
                        ? {
                            scaleY: [1, 0.6, 1.2, 0.93, 1.05, 1],
                            scaleX: [1, 1.22, 0.88, 1.06, 0.97, 1],
                            borderColor: 'rgba(250,204,21,0.95)'
                          }
                        : { opacity: [1, 0.5, 1], borderColor: 'rgba(250,204,21,0.9)' }
                      : phase === 'voiding'
                        ? { opacity: [1, 0.4, 1], scale: [1, 0.94, 1], borderColor: 'rgba(167,139,250,0.9)' }
                        : { scale: [1, 1.06, 1], borderColor: 'rgba(255,255,255,0.3)' }
            }
            transition={
              phase === 'processing' && justLanded
                ? { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
                : phase === 'armed' || phase === 'processing' || phase === 'voiding'
                  ? { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.4 }
            }
          >
            <AnimatePresence mode="wait">
              {phase === 'success' && (
                <motion.span
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                  className="text-2xl text-green-400"
                >
                  ✓
                </motion.span>
              )}
              {phase === 'error' && (
                <motion.span
                  key="x"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                  className="text-2xl text-red-400"
                >
                  ✕
                </motion.span>
              )}
              {phase === 'already-empty' && (
                <motion.span
                  key="empty"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                  className="text-2xl text-white/40"
                >
                  ∅
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          <p className="text-sm font-medium text-white/80">{promptText[phase]}</p>

          {phase === 'armed' && <p className="text-xs text-white/40">This can&apos;t be undone</p>}

          {phase === 'already-empty' && (
            <p className="text-xs text-white/40">Remove the card, nothing to do here</p>
          )}

          {phase === 'error' && (
            <div className="flex gap-3">
              <button
                onClick={() => setPhase('armed')}
                className="rounded-full bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="rounded-full px-4 py-1.5 text-sm text-white/50 hover:text-white/80"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {dismissable && <p className="absolute bottom-10 text-xs text-white/40">Click anywhere to cancel</p>}
    </motion.div>
  )
}
