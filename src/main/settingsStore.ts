import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface AppSettings {
  steamGridDbApiKey?: string
}

const DEFAULT_SETTINGS: AppSettings = {}

let settings: AppSettings = { ...DEFAULT_SETTINGS }
let loaded = false

function storePath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function load(): void {
  if (loaded) return
  loaded = true
  try {
    if (existsSync(storePath())) {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(storePath(), 'utf8')) }
    }
  } catch (err) {
    console.error('[settings] failed to load', err)
    settings = { ...DEFAULT_SETTINGS }
  }
}

function persist(): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(storePath(), JSON.stringify(settings, null, 2))
  } catch (err) {
    console.error('[settings] failed to persist', err)
  }
}

export function getSettings(): AppSettings {
  load()
  return { ...settings }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  load()
  settings = { ...settings, ...patch }
  persist()
  return { ...settings }
}

export function getSteamGridDbApiKey(): string | undefined {
  load()
  return settings.steamGridDbApiKey
}
