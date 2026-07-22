import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Game } from '@shared/types'

const PLATFORM_LABEL: Record<Game['platform'], string> = { steam: 'Steam', gog: 'GOG' }
const PLATFORM_COLOR: Record<Game['platform'], string> = { steam: 'bg-steam/90', gog: 'bg-gog/90' }

export function GameCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const candidates = useMemo(
    () => [game.art, game.artFallback].filter((x): x is string => !!x),
    [game.art, game.artFallback]
  )
  const [attempt, setAttempt] = useState(0)
  const src = candidates[attempt]

  return (
    <motion.button
      onClick={onClick}
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-ink-soft text-left shadow-lg shadow-black/40"
      whileHover={{ scale: 1.045, y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {src ? (
        <img
          src={src}
          alt={game.title}
          draggable={false}
          onError={() => setAttempt((a) => a + 1)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent p-3 text-center text-sm font-semibold text-white/70">
          {game.title}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-70 transition-opacity group-hover:opacity-90" />

      <span
        className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-black uppercase ${PLATFORM_COLOR[game.platform]}`}
      >
        {PLATFORM_LABEL[game.platform]}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow">{game.title}</p>
      </div>

      <motion.div
        className="absolute inset-0 rounded-2xl ring-2 ring-white/0 group-hover:ring-white/30"
        transition={{ duration: 0.2 }}
      />
    </motion.button>
  )
}
