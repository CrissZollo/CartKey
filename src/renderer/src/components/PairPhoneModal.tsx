import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toDataURL } from 'qrcode'
import type { PairedDeviceStatus, PairingSession } from '@shared/types'

export function PairPhoneModal({ onClose }: { onClose: () => void }) {
  const [session, setSession] = useState<PairingSession | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [devices, setDevices] = useState<PairedDeviceStatus[]>([])

  function refreshSession(): void {
    setQrDataUrl(null)
    void window.api.phone.startPairing().then(setSession)
  }

  useEffect(() => {
    refreshSession()
    return () => {
      void window.api.phone.cancelPairing()
    }
  }, [])

  useEffect(() => {
    const unsub = window.api.phone.onDevicesChanged(setDevices)
    void window.api.phone.listDevices().then(setDevices)
    return unsub
  }, [])

  useEffect(() => {
    if (!session) return
    void toDataURL(session.uri, {
      margin: 1,
      width: 216,
      color: { dark: '#0b0d17', light: '#ffffff' }
    }).then(setQrDataUrl)
  }, [session])

  useEffect(() => {
    if (!session) return undefined
    const tick = (): void => setRemainingMs(Math.max(0, session.expiresAt - Date.now()))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session])

  const expired = !!session && remainingMs <= 0

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/10 bg-ink-soft p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-center text-lg font-bold">Pair a phone</h2>
          <p className="mt-1 text-center text-sm text-white/50">
            Open CartKey on your phone and scan this code
          </p>
        </div>

        <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-white p-3">
          {expired ? (
            <button
              onClick={refreshSession}
              className="px-4 text-center text-sm font-medium text-ink hover:underline"
            >
              Code expired — tap to get a new one
            </button>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="Pairing QR code" className="h-full w-full" />
          ) : (
            <span className="text-sm text-ink/40">Generating…</span>
          )}
        </div>

        {devices.length > 0 && (
          <div className="w-full border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-white/40 uppercase">
              Paired devices
            </p>
            <ul className="flex flex-col gap-2">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.connected ? '#22c55e' : '#6b7280' }}
                    />
                    <span>{d.name}</span>
                  </div>
                  <button
                    onClick={() => void window.api.phone.revokeDevice(d.id)}
                    className="text-xs text-white/40 hover:text-red-400"
                  >
                    Forget
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={onClose} className="rounded-full px-4 py-1.5 text-sm text-white/50 hover:text-white/80">
          Close
        </button>
      </div>
    </motion.div>
  )
}
