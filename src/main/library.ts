import type { Game } from '../shared/types'
import { scanSteamLibrary } from './steamLibrary'
import { scanHeroicGogLibrary } from './heroicLibrary'
import { scanGogGalaxyLibrary } from './gogGalaxyLibrary'

let cache: Game[] = []

// GOG Galaxy is Windows-only (it doesn't run natively on Linux/Mac), so
// those platforms go through Heroic's local library instead.
function scanGogLibrary(): Promise<Game[]> {
  return process.platform === 'win32' ? scanGogGalaxyLibrary() : scanHeroicGogLibrary()
}

export async function refreshLibrary(): Promise<Game[]> {
  const [steamGames, gogGames] = await Promise.all([scanSteamLibrary(), scanGogLibrary()])
  cache = [...steamGames, ...gogGames].sort((a, b) => a.title.localeCompare(b.title))
  return cache
}

export function getLibrary(): Game[] {
  return cache
}

export function findGame(platform: Game['platform'], id: string): Game | undefined {
  return cache.find((g) => g.platform === platform && g.id === id)
}
