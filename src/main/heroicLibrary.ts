import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import type { Game } from '../shared/types'

const CANDIDATE_CONFIG_DIRS = [
  join(homedir(), '.config/heroic'),
  process.env.APPDATA ? join(process.env.APPDATA, 'heroic') : null,
  join(homedir(), 'Library/Application Support/heroic')
].filter((p): p is string => !!p)

interface GogLibraryGame {
  app_name: string
  title: string
  art_cover?: string
  art_square?: string
}

interface GogLibraryFile {
  games?: GogLibraryGame[]
}

interface GogInstalledEntry {
  appName: string
  is_dlc?: boolean
}

interface GogInstalledFile {
  installed?: GogInstalledEntry[]
}

function findHeroicConfigDir(): string | null {
  return CANDIDATE_CONFIG_DIRS.find((p) => existsSync(join(p, 'store_cache', 'gog_library.json'))) ?? null
}

// gog_library.json's own `is_installed` field is a stale snapshot from the
// remote catalog, not the real local install state — the actual source of
// truth is gog_store/installed.json, which Heroic keeps in sync with disk.
async function readInstalledAppNames(configDir: string): Promise<Set<string>> {
  try {
    const text = await readFile(join(configDir, 'gog_store', 'installed.json'), 'utf8')
    const parsed = JSON.parse(text) as GogInstalledFile
    return new Set((parsed.installed ?? []).filter((e) => !e.is_dlc).map((e) => e.appName))
  } catch {
    return new Set()
  }
}

export async function scanHeroicGogLibrary(): Promise<Game[]> {
  const configDir = findHeroicConfigDir()
  if (!configDir) return []

  const installedAppNames = await readInstalledAppNames(configDir)
  if (installedAppNames.size === 0) return []

  try {
    const text = await readFile(join(configDir, 'store_cache', 'gog_library.json'), 'utf8')
    const parsed = JSON.parse(text) as GogLibraryFile
    const games = parsed.games ?? []

    return games
      .filter((g) => installedAppNames.has(g.app_name))
      .map((g) => ({
        platform: 'gog' as const,
        id: g.app_name,
        title: g.title,
        art: g.art_cover ?? g.art_square,
        artFallback: g.art_cover ? g.art_square : undefined,
        installed: true
      }))
  } catch {
    return []
  }
}

export function heroicLaunchUri(appName: string): string {
  return `heroic://launch/${appName}`
}
