import { app } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { generate } from 'selfsigned'

export interface TlsIdentity {
  key: string
  cert: string
  /** SHA-256 of the DER-encoded cert, hex — this is what gets pinned by the Android client. */
  fingerprint: string
}

let cached: TlsIdentity | null = null

function certDir(): string {
  return join(app.getPath('userData'), 'remote-tls')
}

function fingerprintOf(certPem: string): string {
  const der = Buffer.from(
    certPem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\s+/g, ''),
    'base64'
  )
  return createHash('sha256').update(der).digest('hex')
}

/** Loads the persisted self-signed identity, generating one on first run. Cheap
 * to call repeatedly — the actual generation only ever happens once per install. */
export async function getTlsIdentity(): Promise<TlsIdentity> {
  if (cached) return cached

  const dir = certDir()
  const keyPath = join(dir, 'key.pem')
  const certPath = join(dir, 'cert.pem')

  if (existsSync(keyPath) && existsSync(certPath)) {
    const key = readFileSync(keyPath, 'utf8')
    const cert = readFileSync(certPath, 'utf8')
    cached = { key, cert, fingerprint: fingerprintOf(cert) }
    return cached
  }

  const notAfterDate = new Date()
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 10)
  const pair = await generate([{ name: 'commonName', value: 'CartKey' }], {
    notAfterDate,
    keySize: 2048
  })

  mkdirSync(dir, { recursive: true })
  writeFileSync(keyPath, pair.private, { mode: 0o600 })
  writeFileSync(certPath, pair.cert, { mode: 0o600 })

  cached = { key: pair.private, cert: pair.cert, fingerprint: fingerprintOf(pair.cert) }
  return cached
}
