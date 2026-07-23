import { existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import type { Game } from '../shared/types'
import { parseVdf, type VdfObject } from './vdf'
import { fetchSteamGridDbArt, getCachedArtPath } from './steamGridDb'
import { getSteamGridDbApiKey } from './settingsStore'

const CANDIDATE_ROOTS = [
  join(homedir(), '.local/share/Steam'),
  join(homedir(), '.steam/steam'),
  join(homedir(), '.steam/root'),
  'C:\\Program Files (x86)\\Steam',
  join(homedir(), 'Library/Application Support/Steam')
]

// Common non-game noise that shows up as regular appmanifests in every Steam library.
const NAME_DENYLIST = /^(steamworks common redistributables|proton\b|steam linux runtime|steamvr)/i

function findSteamRoots(): string[] {
  return CANDIDATE_ROOTS.filter((p) => existsSync(join(p, 'steamapps')))
}

async function libraryPathsFrom(root: string): Promise<string[]> {
  const vdfPath = join(root, 'steamapps', 'libraryfolders.vdf')
  const paths = new Set<string>([root])
  if (!existsSync(vdfPath)) return [...paths]

  try {
    const text = await readFile(vdfPath, 'utf8')
    const parsed = parseVdf(text)
    const folders = (parsed['libraryfolders'] as VdfObject) ?? parsed
    for (const value of Object.values(folders)) {
      if (typeof value === 'object' && typeof value['path'] === 'string') {
        paths.add(value['path'])
      }
    }
  } catch {
    // fall back to just the root
  }
  return [...paths]
}

/** Resolves art for a single Steam app. Cascades:
 *  1. Local Steam librarycache → file:// path (best, always works if cached)
 *  2. Locally cached SteamGridDB art → file:// path (downloaded previously)
 *  3. SteamGridDB API (if API key is set) → download + cache → file:// path
 *  4. Steam CDN URL guess → https:// URL (last resort)
 *
 *  `artFallback` is always the universal CDN header.jpg as a final safety net. */
async function artForApp(steamRoot: string, appid: string): Promise<Pick<Game, 'art' | 'artFallback'>> {
  const localCandidates = ['library_600x900.jpg', 'library_hero.jpg', 'header.jpg'].map((f) =>
    join(steamRoot, 'appcache', 'librarycache', appid, f)
  )
  const local = localCandidates.find((p) => existsSync(p))
  const cdnFallback = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
  if (local) return { art: `file://${local}`, artFallback: cdnFallback }

  // Check for previously cached SteamGridDB art.
  const cachedSgdb = getCachedArtPath('steam', appid)
  if (cachedSgdb) return { art: cachedSgdb, artFallback: cdnFallback }

  // Try SteamGridDB live lookup if API key is configured.
  const apiKey = getSteamGridDbApiKey()
  if (apiKey) {
    const sgdbArt = await fetchSteamGridDbArt(apiKey, appid)
    if (sgdbArt) return { art: sgdbArt, artFallback: cdnFallback }
  }

  return {
    art: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    artFallback: cdnFallback
  }
}

export async function scanSteamLibrary(): Promise<Game[]> {
  const roots = findSteamRoots()
  const games: Game[] = []
  const seenAppIds = new Set<string>()

  for (const root of roots) {
    const libraryPaths = await libraryPathsFrom(root)
    for (const libPath of libraryPaths) {
      const steamappsDir = join(libPath, 'steamapps')
      if (!existsSync(steamappsDir)) continue

      let entries: string[]
      try {
        entries = await readdir(steamappsDir)
      } catch {
        continue
      }

      for (const entry of entries) {
        const match = entry.match(/^appmanifest_(\d+)\.acf$/)
        if (!match) continue
        const appid = match[1]
        if (seenAppIds.has(appid)) continue

        try {
          const text = await readFile(join(steamappsDir, entry), 'utf8')
          const parsed = parseVdf(text)
          const state = (parsed['AppState'] as VdfObject) ?? parsed
          const name = state['name']
          if (typeof name !== 'string' || !name || NAME_DENYLIST.test(name)) continue

          seenAppIds.add(appid)
          games.push({
            platform: 'steam',
            id: appid,
            title: name,
            ...(await artForApp(root, appid)),
            installed: true
          })
        } catch {
          continue
        }
      }
    }
  }

  return games
}

export function steamLaunchUri(appid: string): string {
  return `steam://rungameid/${appid}`
}
