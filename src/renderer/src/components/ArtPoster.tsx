import { useMemo, useState } from 'react'

export function ArtPoster({
  art,
  artFallback,
  title,
  className
}: {
  art?: string
  artFallback?: string
  title: string
  className?: string
}) {
  const candidates = useMemo(
    () => [art, artFallback].filter((x): x is string => !!x),
    [art, artFallback]
  )
  const [attempt, setAttempt] = useState(0)
  const src = candidates[attempt]

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-ink-soft p-3 text-center text-sm font-semibold text-white/70 ${className ?? ''}`}
      >
        {title}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={title}
      onError={() => setAttempt((a) => a + 1)}
      className={`object-cover ${className ?? ''}`}
    />
  )
}
