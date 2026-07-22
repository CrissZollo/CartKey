import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Game } from '@shared/types'
import { useAppStore } from '../lib/store'
import { GameCard } from '../components/GameCard'
import { ProgramModal } from '../components/ProgramModal'
import { ReaderStatusPill } from '../components/ReaderStatusPill'

export function LibraryScreen() {
  const games = useAppStore((s) => s.games)
  const loading = useAppStore((s) => s.loadingLibrary)
  const setGames = useAppStore((s) => s.setGames)
  const setLoading = useAppStore((s) => s.setLoadingLibrary)
  const [selected, setSelected] = useState<Game | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    window.api.library.list().then((g) => {
      setGames(g)
      setLoading(false)
    })
  }, [setGames, setLoading])

  async function handleRefresh(): Promise<void> {
    setRefreshing(true)
    const g = await window.api.library.refresh()
    setGames(g)
    setRefreshing(false)
  }

  return (
    <div className="flex h-full flex-col px-8 pt-8 pb-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">CartKey</h1>
          <p className="mt-1 text-sm text-white/50">
            Pick a game, tap your card, take it anywhere.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ReaderStatusPill />
          <motion.button
            onClick={handleRefresh}
            whileTap={{ scale: 0.94 }}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh library'}
          </motion.button>
        </div>
      </header>

      <div className="flex-1 overflow-x-hidden overflow-y-auto pb-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-white/40">
            Scanning your Steam and GOG library…
          </div>
        ) : games.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/40">
            <p>No installed games found.</p>
            <p className="text-xs">
              Make sure Steam and/or Heroic are installed with at least one game.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {games.map((g) => (
              <GameCard key={`${g.platform}:${g.id}`} game={g} onClick={() => setSelected(g)} />
            ))}
          </div>
        )}
      </div>

      {selected && <ProgramModal game={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
