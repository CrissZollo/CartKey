import { execFile } from 'child_process'
import type { Game } from '../shared/types'

// GOG Galaxy (Windows only — the native client doesn't run on Linux/Mac,
// which is why the other platforms go through Heroic instead). Installed
// games are registered under this key by GOG's own installer, one sub-key
// per game named after its product id.
const GAMES_KEY = 'HKLM\\Software\\GOG.com\\Games'
const CLIENT_PATHS_KEY = 'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths'
const DEFAULT_CLIENT_EXE = 'C:\\Program Files (x86)\\GOG Galaxy\\GalaxyClient.exe'

function regQuery(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile('reg', ['query', ...args], (err, stdout) => {
      resolve(err ? '' : stdout)
    })
  })
}

async function listGameIds(): Promise<string[]> {
  const output = await regQuery([GAMES_KEY])
  const prefix = GAMES_KEY.toLowerCase()
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith(prefix))
    .map((line) => line.split('\\').pop() ?? '')
    .filter(Boolean)
}

async function readValue(key: string, value: string): Promise<string | undefined> {
  const output = await regQuery([key, '/v', value])
  const match = output.match(new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`, 'i'))
  return match ? match[1].trim() : undefined
}

interface GogProductArt {
  images?: { logo?: string; background?: string }
}

async function fetchArt(gameId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.gog.com/products/${gameId}?expand=images`)
    if (!res.ok) return undefined
    const data = (await res.json()) as GogProductArt
    const url = data.images?.background ?? data.images?.logo
    if (!url) return undefined
    return url.startsWith('//') ? `https:${url}` : url
  } catch {
    return undefined
  }
}

export async function scanGogGalaxyLibrary(): Promise<Game[]> {
  if (process.platform !== 'win32') return []

  const gameIds = await listGameIds()

  const games = await Promise.all(
    gameIds.map(async (id): Promise<Game | null> => {
      const title = await readValue(`${GAMES_KEY}\\${id}`, 'gameName')
      if (!title) return null
      const art = await fetchArt(id)
      return { platform: 'gog', id, title, art, installed: true }
    })
  )

  return games.filter((g): g is Game => g !== null)
}

let cachedClientExe: string | undefined

async function findGalaxyClientExe(): Promise<string> {
  if (cachedClientExe) return cachedClientExe
  const clientDir = await readValue(CLIENT_PATHS_KEY, 'client')
  cachedClientExe = clientDir ? `${clientDir}\\GalaxyClient.exe` : DEFAULT_CLIENT_EXE
  return cachedClientExe
}

export async function launchGogGalaxyGame(gameId: string): Promise<void> {
  const clientExe = await findGalaxyClientExe()
  const installPath = await readValue(`${GAMES_KEY}\\${gameId}`, 'path')
  const args = ['/command=runGame', `/gameId=${gameId}`]
  if (installPath) args.push(`/path=${installPath}`)

  await new Promise<void>((resolve, reject) => {
    execFile(clientExe, args, (err) => (err ? reject(err) : resolve()))
  })
}
