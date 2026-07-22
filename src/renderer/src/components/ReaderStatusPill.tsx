import { motion } from 'framer-motion'
import { useAppStore } from '../lib/store'

const LABEL: Record<string, string> = {
  'no-reader': 'No reader detected',
  idle: 'Ready to scan',
  'card-present': 'Card on reader'
}

const DOT_COLOR: Record<string, string> = {
  'no-reader': '#ef4444',
  idle: '#22c55e',
  'card-present': '#facc15'
}

export function ReaderStatusPill() {
  const status = useAppStore((s) => s.readerStatus)
  const color = DOT_COLOR[status.state]

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
      <motion.span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        animate={
          status.state === 'no-reader'
            ? { opacity: 1 }
            : { opacity: [1, 0.35, 1], scale: [1, 1.3, 1] }
        }
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-xs font-medium text-white/70">{LABEL[status.state]}</span>
    </div>
  )
}
