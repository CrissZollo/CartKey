import open from 'open'
import type { Game } from '../shared/types'
import { steamLaunchUri } from './steamLibrary'
import { heroicLaunchUri } from './heroicLibrary'
import { launchGogGalaxyGame } from './gogGalaxyLibrary'

export async function launchGame(game: Pick<Game, 'platform' | 'id'>): Promise<void> {
  if (game.platform === 'steam') {
    await open(steamLaunchUri(game.id))
    return
  }

  if (process.platform === 'win32') {
    await launchGogGalaxyGame(game.id)
  } else {
    await open(heroicLaunchUri(game.id))
  }
}
