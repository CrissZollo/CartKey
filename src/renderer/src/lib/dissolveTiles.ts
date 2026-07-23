import { useEffect, useMemo, useState } from 'react'

/** Shared poster-dissolve box size (px) — matches the h-72 w-52 art box in
 * both the program and erase modals. Kept as constants (rather than
 * measuring the DOM) since the box size is fixed by that className. */
export const BOX_WIDTH = 208
export const BOX_HEIGHT = 288
const GRID_COLS = 6
const GRID_ROWS = 8
export const TILE_TRAVEL_DURATION = 0.95

// Heavy, sudden acceleration — starts slow, then yanks hard — so each chunk
// reads as moving under real force rather than a generic ease, whichever
// direction it travels.
export const DISSOLVE_EASE: [number, number, number, number] = [0.65, 0, 0.85, 0.15]

export type DissolveDirection = 'in' | 'out'

export interface DissolveTile {
  row: number
  col: number
  left: number
  top: number
  delay: number
  travelDistance: number
  driftX: number
  rotate: number
}

// How much of each tile's horizontal distance-from-center gets cancelled by
// the time it reaches the vanishing point — close to 1 collapses everything
// down to a narrow neck, tracing a funnel/cone shape rather than a straight line.
const FUNNEL_CONVERGENCE = 0.94

/**
 * A grid of image-cropped tiles that pixelate and pour through a funnel neck.
 *
 * `'in'` (loading a card): tiles fall from the poster down into the card,
 * bottom row leaving first — the poster is being sucked downward into it.
 *
 * `'out'` (erasing a card): tiles fly up and away from the poster into
 * nothing, top row leaving first — the poster is being sucked out of the
 * card into the void above it.
 *
 * Recomputed fresh each time `active` flips on so a retry gets a new dissolve.
 */
export function useDissolveTiles(active: boolean, direction: DissolveDirection = 'in'): DissolveTile[] {
  return useMemo(() => {
    if (!active) return []
    const tileWidth = BOX_WIDTH / GRID_COLS
    const tileHeight = BOX_HEIGHT / GRID_ROWS
    const rowStagger = 0.09
    const tiles: DissolveTile[] = []
    for (let row = 0; row < GRID_ROWS; row++) {
      // 'in': bottom row (closest to the card below) leaves first.
      // 'out': top row (closest to the void above) leaves first.
      const rowOrder = direction === 'in' ? GRID_ROWS - 1 - row : row
      const reach = (direction === 'in' ? GRID_ROWS - row : row + 1) * tileHeight + 44 + Math.random() * 18
      for (let col = 0; col < GRID_COLS; col++) {
        const tileCenterX = col * tileWidth + tileWidth / 2
        const offsetFromCenter = tileCenterX - BOX_WIDTH / 2
        tiles.push({
          row,
          col,
          left: col * tileWidth,
          top: row * tileHeight,
          delay: 0.15 + rowOrder * rowStagger + Math.random() * 0.07,
          travelDistance: direction === 'in' ? reach : -reach,
          driftX: -offsetFromCenter * FUNNEL_CONVERGENCE + (Math.random() - 0.5) * 6,
          rotate: (Math.random() - 0.5) * 18
        })
      }
    }
    return tiles
  }, [active, direction])
}

export interface CoverFit {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

/** Mirrors `object-fit: cover` for a CSS background-image, so slicing the
 * poster into tiles doesn't distort its aspect ratio the way stretch-to-fit
 * background-size percentages would. */
export function useCoverFit(src: string | undefined): CoverFit | null {
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

export const DISSOLVE_GRID = { cols: GRID_COLS, rows: GRID_ROWS }
