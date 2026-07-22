import type { Game } from '../shared/types'
import { scanSteamLibrary } from './steamLibrary'
import { scanHeroicGogLibrary } from './heroicLibrary'

let cache: Game[] = []

export async function refreshLibrary(): Promise<Game[]> {
  const [steamGames, gogGames] = await Promise.all([scanSteamLibrary(), scanHeroicGogLibrary()])
  cache = [...steamGames, ...gogGames].sort((a, b) => a.title.localeCompare(b.title))
  return cache
}

export function getLibrary(): Game[] {
  return cache
}

export function findGame(platform: Game['platform'], id: string): Game | undefined {
  return cache.find((g) => g.platform === platform && g.id === id)
}
