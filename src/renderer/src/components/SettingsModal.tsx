import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.api.settings.get().then((s) => {
      if (s.steamGridDbApiKey) setApiKey(s.steamGridDbApiKey as string)
    })
  }, [])

  function handleSave(): void {
    void window.api.settings.set({ steamGridDbApiKey: apiKey.trim() }).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void window.api.library.refresh()
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-white/10 bg-ink-soft p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-bold">Settings</h2>
          <p className="mt-1 text-sm text-white/50">
            Configure a SteamGridDB API key to fetch missing poster art for your games.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-white/40 uppercase">
            SteamGridDB API Key
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key here"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none"
          />
          <span className="text-xs text-white/30">
            Get one at steamgriddb.com/profile/preferences/api
          </span>
        </label>

        <div className="flex items-center justify-between">
          {saved && <span className="text-xs text-green-400">Saved!</span>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-sm text-white/50 hover:text-white/80"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="rounded-full bg-white/10 px-5 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
