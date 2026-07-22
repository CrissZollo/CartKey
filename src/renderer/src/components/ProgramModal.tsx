import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Game, WriteOutcome } from '@shared/types'
import { useAppStore } from '../lib/store'
import { ArtPoster } from './ArtPoster'

type Phase = 'armed' | 'already-loaded' | 'confirming' | 'sucking' | 'processing' | 'success' | 'error'

interface ExistingCardInfo {
  title: string
  art?: string
  artFallback?: string
}

// The real card write is fast enough to finish before the user has even
// looked up from placing the card — hold each phase for at least this long
// regardless of how quickly the hardware actually responds, so the animation
// is never skipped past.
const MIN_SUCKING_MS = 1750
const MIN_PROCESSING_MS = 1400

// Box in px — matches the h-72 w-52 art box below. Kept as constants (rather
// than measuring the DOM) since the box size is fixed by that className.
const BOX_WIDTH = 208
const BOX_HEIGHT = 288
const GRID_COLS = 6
const GRID_ROWS = 8
const TILE_FALL_DURATION = 0.95
// Heavy gravity-style acceleration — starts slow, drops hard, rather than a
// generic ease — so each chunk reads as falling under real weight.
const GRAVITY_EASE: [number, number, number, number] = [0.65, 0, 0.85, 0.15]

interface DissolveTile {
  row: number
  col: number
  left: number
  top: number
  delay: number
  fallDistance: number
  driftX: number
  rotate: number
}

// How much of each tile's horizontal distance-from-center gets cancelled by
// the time it reaches the card — close to 1 collapses everything down to a
// narrow neck, tracing a funnel/cone shape rather than falling straight down.
const FUNNEL_CONVERGENCE = 0.94

/** A grid of image-cropped tiles that pixelate and pour down into the card
 * in a funnel: each tile falls from its own spot on the poster (the wide
 * mouth) and converges toward the horizontal center as it drops, narrowing
 * to a point near the card (the neck) — like the poster is being sucked
 * into it. Recomputed fresh each time `active` flips on so a retry after an
 * error gets a new dissolve. */
function useDissolveTiles(active: boolean): DissolveTile[] {
  return useMemo(() => {
    if (!active) return []
    const tileWidth = BOX_WIDTH / GRID_COLS
    const tileHeight = BOX_HEIGHT / GRID_ROWS
    const rowStagger = 0.09
    const tiles: DissolveTile[] = []
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const rowFromBottom = GRID_ROWS - 1 - row
        const tileCenterX = col * tileWidth + tileWidth / 2
        const offsetFromCenter = tileCenterX - BOX_WIDTH / 2
        tiles.push({
          row,
          col,
          left: col * tileWidth,
          top: row * tileHeight,
          delay: 0.15 + rowFromBottom * rowStagger + Math.random() * 0.07,
          fallDistance: (GRID_ROWS - row) * tileHeight + 44 + Math.random() * 18,
          driftX: -offsetFromCenter * FUNNEL_CONVERGENCE + (Math.random() - 0.5) * 6,
          rotate: (Math.random() - 0.5) * 18
        })
      }
    }
    return tiles
  }, [active])
}

interface CoverFit {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

/** Mirrors `object-fit: cover` for a CSS background-image, so slicing the
 * poster into tiles doesn't distort its aspect ratio the way stretch-to-fit
 * background-size percentages would. */
function useCoverFit(src: string | undefined): CoverFit | null {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!src) {
      setNatural(null)
      return undefined
    }
    let cancelled = false
    const img = new Image()
    img.onload = (): void => {
      if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  return useMemo(() => {
    if (!natural || !natural.w || !natural.h) return null
    const scale = Math.max(BOX_WIDTH / natural.w, BOX_HEIGHT / natural.h)
    const width = natural.w * scale
    const height = natural.h * scale
    return { width, height, offsetX: (width - BOX_WIDTH) / 2, offsetY: (height - BOX_HEIGHT) / 2 }
  }, [natural])
}

export function ProgramModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('armed')
  const [errorMessage, setErrorMessage] = useState('')
  const cardEvent = useAppStore((s) => s.cardEvent)
  const setProgramModalOpen = useAppStore((s) => s.setProgramModalOpen)
  const artCandidates = useMemo(
    () => [game.art, game.artFallback].filter((x): x is string => !!x),
    [game.art, game.artFallback]
  )
  const [artAttempt, setArtAttempt] = useState(0)
  const artSrc = artCandidates[artAttempt]
  const coverFit = useCoverFit(artSrc)
  const dissolving = phase === 'sucking' || phase === 'processing' || phase === 'success' || phase === 'error'
  const tiles = useDissolveTiles(dissolving)
  const [existingInfo, setExistingInfo] = useState<ExistingCardInfo | null>(null)
  const [justLanded, setJustLanded] = useState(false)
  const pendingOutcomeRef = useRef<WriteOutcome | null>(null)
  const minProcessingElapsedRef = useRef(false)

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
    setProgramModalOpen(true)
    void window.api.card.beginProgram({
      version: 1,
      platform: game.platform,
      id: game.id,
      title: game.title,
      artUrl: [game.art, game.artFallback].find((u) => u?.startsWith('http'))
    })
    return () => {
      setProgramModalOpen(false)
      void window.api.card.cancelProgram()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!cardEvent) return
    if (cardEvent.type === 'already-loaded') {
      setPhase('already-loaded')
    } else if (cardEvent.type === 'confirm-overwrite') {
      const { existing, existingLocalMatch } = cardEvent
      setExistingInfo({
        title: existingLocalMatch?.title ?? existing.title,
        art: existingLocalMatch?.art ?? existing.artUrl,
        artFallback: existingLocalMatch?.artFallback
      })
      setPhase('confirming')
    } else if (cardEvent.type === 'write-start') {
      pendingOutcomeRef.current = null
      minProcessingElapsedRef.current = false
      setPhase('sucking')
    } else if (cardEvent.type === 'write-result') {
      // The real write often finishes almost instantly — store the result
      // and only reveal it once the animation has actually had time to play.
      pendingOutcomeRef.current = cardEvent.outcome
      revealIfReady()
    } else if (
      cardEvent.type === 'card-removed' &&
      (phase === 'confirming' || phase === 'already-loaded')
    ) {
      // User lifted the card instead of confirming (or after seeing the
      // already-loaded notice) — that's the cancel/dismiss gesture.
      setExistingInfo(null)
      setPhase('armed')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardEvent])

  useEffect(() => {
    if (phase === 'sucking') {
      const t = setTimeout(() => setPhase('processing'), MIN_SUCKING_MS)
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
    // The dissolve just finished pouring into the card — a heavy "thud" as it
    // lands, before settling into the ongoing writing pulse.
    setJustLanded(true)
    const t = setTimeout(() => setJustLanded(false), 500)
    return () => clearTimeout(t)
  }, [phase])

  const promptText: Record<Phase, string> = {
    armed: 'Tap your card on the reader',
    'already-loaded': `${game.title} is already on this card`,
    confirming: '',
    sucking: 'Reading card…',
    processing: 'Writing to card…',
    success: 'Loaded!',
    error: errorMessage || 'Something went wrong'
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={phase === 'armed' ? onClose : undefined}
    >
      {phase === 'confirming' && existingInfo ? (
        <motion.div
          className="flex flex-col items-center gap-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="h-56 w-40 overflow-hidden rounded-2xl shadow-xl shadow-black/50 ring-2 ring-white/10">
                <ArtPoster
                  art={existingInfo.art}
                  artFallback={existingInfo.artFallback}
                  title={existingInfo.title}
                  className="h-full w-full"
                />
              </div>
              <span className="text-[11px] font-semibold tracking-wide text-white/40 uppercase">
                Currently on card
              </span>
              <p className="max-w-40 text-center text-sm font-semibold text-white/80">
                {existingInfo.title}
              </p>
            </div>

            <motion.span
              className="text-3xl text-white/50"
              animate={{ x: [0, 10, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              →
            </motion.span>

            <div className="flex flex-col items-center gap-2">
              <div className="shadow-steam/30 ring-steam/60 h-56 w-40 overflow-hidden rounded-2xl shadow-xl ring-2">
                <ArtPoster
                  art={game.art}
                  artFallback={game.artFallback}
                  title={game.title}
                  className="h-full w-full"
                />
              </div>
              <span className="text-steam text-[11px] font-semibold tracking-wide uppercase">
                New game
              </span>
              <p className="max-w-40 text-center text-sm font-semibold text-white">{game.title}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <motion.button
              onClick={() => void window.api.card.confirmOverwrite()}
              whileTap={{ scale: 0.95 }}
              className="bg-steam shadow-steam/30 rounded-full px-6 py-2.5 text-sm font-bold text-black shadow-lg"
            >
              Load {game.title} onto this card
            </motion.button>
            <p className="text-xs text-white/40">
              Remove the card if you don&apos;t want to overwrite it
            </p>
          </div>
        </motion.div>
      ) : (
      <div
        className="relative flex flex-col items-center gap-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`relative h-72 w-52 shadow-2xl shadow-black/60 ${dissolving ? 'overflow-visible' : 'overflow-hidden rounded-2xl'}`}
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
                    width: BOX_WIDTH / GRID_COLS,
                    height: BOX_HEIGHT / GRID_ROWS,
                    backgroundImage: artSrc ? `url("${artSrc}")` : undefined,
                    backgroundSize: `${coverFit.width}px ${coverFit.height}px`,
                    backgroundPosition: `${-(coverFit.offsetX + t.left)}px ${-(coverFit.offsetY + t.top)}px`
                  }}
                  initial={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
                  animate={{
                    opacity: [1, 1, 0.9, 0],
                    y: t.fallDistance,
                    x: t.driftX,
                    rotate: t.rotate,
                    scale: [1, 0.85, 0.4, 0.1]
                  }}
                  transition={{
                    duration: TILE_FALL_DURATION,
                    delay: t.delay,
                    times: [0, 0.2, 0.7, 1],
                    ease: GRAVITY_EASE
                  }}
                />
              ))}
            </div>
          ) : artSrc ? (
            <img
              src={artSrc}
              alt={game.title}
              onError={() => setArtAttempt((a) => a + 1)}
              className="h-full w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-ink-soft p-4 text-center font-semibold">
              {game.title}
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
                  : phase === 'already-loaded'
                    ? { scale: [1, 1.08, 1], borderColor: 'rgba(102,192,244,0.9)' }
                    : phase === 'processing'
                      ? justLanded
                        ? {
                            scaleY: [1, 0.6, 1.2, 0.93, 1.05, 1],
                            scaleX: [1, 1.22, 0.88, 1.06, 0.97, 1],
                            borderColor: 'rgba(250,204,21,0.95)'
                          }
                        : { opacity: [1, 0.5, 1], borderColor: 'rgba(250,204,21,0.9)' }
                      : { scale: [1, 1.06, 1], borderColor: 'rgba(255,255,255,0.3)' }
            }
            transition={
              phase === 'processing' && justLanded
                ? { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
                : phase === 'armed' || phase === 'processing'
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
              {phase === 'already-loaded' && (
                <motion.span
                  key="already"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                  className="text-steam text-2xl"
                >
                  ✓
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          <p className="text-sm font-medium text-white/80">{promptText[phase]}</p>

          {phase === 'already-loaded' && (
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
      )}

      {phase === 'armed' && (
        <p className="absolute bottom-10 text-xs text-white/40">Click anywhere to cancel</p>
      )}
    </motion.div>
  )
}
