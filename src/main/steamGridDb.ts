import { app } from 'electron'
import { createWriteStream, existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { get } from 'https'

const CACHE_DIR = join(app.getPath('userData'), 'art-cache')

interface SteamGridDbGrid {
  id: number
  score: number
  style: string
  width: number
  height: number
  url: string
  thumb: string
}

interface SteamGridDbResponse {
  success: boolean
  data: SteamGridDbGrid[]
}

function cachePath(platform: string, id: string): string {
  return join(CACHE_DIR, platform, `${id}.jpg`)
}

/** Returns the cached file:// path if art exists on disk for this game. */
export function getCachedArtPath(platform: string, id: string): string | undefined {
  const path = cachePath(platform, id)
  if (existsSync(path)) return `file://${path}`
  return undefined
}

/** Downloads an image from [url] and caches it locally. Returns the file:// path
 *  on success, or undefined on any failure. */
async function downloadAndCache(url: string, platform: string, id: string): Promise<string | undefined> {
  const dest = cachePath(platform, id)
  await mkdir(join(CACHE_DIR, platform), { recursive: true })
  try {
    await new Promise<void>((resolve, reject) => {
      const file = createWriteStream(dest)
      get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close()
          return reject(new Error(`HTTP ${response.statusCode}`))
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
        file.on('error', (err) => {
          file.close()
          reject(err)
        })
      }).on('error', reject)
    })
    return `file://${dest}`
  } catch {
    return undefined
  }
}

/** Queries SteamGridDB for a grid (poster) image for the given Steam app ID.
 *  Caches the result locally and returns a file:// path, or undefined if
 *  nothing suitable is found. */
export async function fetchSteamGridDbArt(apiKey: string, appId: string): Promise<string | undefined> {
  try {
    const url = `https://www.steamgriddb.com/api/v2/grids/steam/${appId}?styles=alternate,blurred,white_logo,material,no_logo&limit=3`

    const response = await new Promise<SteamGridDbResponse>((resolve, reject) => {
      get(
        url,
        { headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'CartKey/1.0' } },
        (res) => {
          let body = ''
          res.on('data', (chunk: Buffer) => (body += chunk.toString()))
          res.on('end', () => {
            try {
              resolve(JSON.parse(body))
            } catch {
              reject(new Error('Invalid JSON from SteamGridDB'))
            }
          })
          res.on('error', reject)
        }
      ).on('error', reject)
    })

    if (!response.success || !response.data?.length) return undefined

    // Prefer the highest-scored grid that has a full-size URL.
    const sorted = [...response.data].sort((a, b) => b.score - a.score)
    for (const grid of sorted) {
      if (grid.url) {
        const cached = await downloadAndCache(grid.url, 'steam', appId)
        if (cached) return cached
      }
    }
    return undefined
  } catch {
    return undefined
  }
}
