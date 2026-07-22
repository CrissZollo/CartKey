import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { UpdateStatus } from '@shared/types'

export function UpdateModal() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  useEffect(() => {
    const unsub = window.api.update.onStatus(setStatus)
    void window.api.update.getStatus().then(setStatus)
    return unsub
  }, [])

  const visible = status.state === 'ready' && status.version !== dismissedVersion

  return (
    <AnimatePresence>
      {visible && status.state === 'ready' && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-ink-soft flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/60"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <div>
              <span className="text-steam text-xs font-bold tracking-wide uppercase">
                Update ready
              </span>
              <h2 className="text-xl font-bold">CartKey {status.version}</h2>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg bg-black/30 p-3 text-sm whitespace-pre-wrap text-white/70">
              {status.releaseNotes || 'No release notes provided.'}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDismissedVersion(status.version)}
                className="rounded-full px-4 py-1.5 text-sm text-white/50 hover:text-white/80"
              >
                Later
              </button>
              <button
                onClick={() => void window.api.update.install()}
                className="bg-steam rounded-full px-5 py-1.5 text-sm font-bold text-black hover:brightness-110"
              >
                Restart & Update
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
