import open from 'open'
import type { Game } from '../shared/types'
import { steamLaunchUri } from './steamLibrary'
import { heroicLaunchUri } from './heroicLibrary'

export async function launchGame(game: Pick<Game, 'platform' | 'id'>): Promise<void> {
  const uri = game.platform === 'steam' ? steamLaunchUri(game.id) : heroicLaunchUri(game.id)
  await open(uri)
}
