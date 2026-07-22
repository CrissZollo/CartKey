/** Minimal parser for Valve's VDF/KeyValues format, used by libraryfolders.vdf and appmanifest_*.acf. */

export type VdfValue = string | VdfObject
export interface VdfObject {
  [key: string]: VdfValue
}

export function parseVdf(text: string): VdfObject {
  let i = 0
  const n = text.length

  function skipWhitespaceAndComments(): void {
    while (i < n) {
      const c = text[i]
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        i++
        continue
      }
      if (c === '/' && text[i + 1] === '/') {
        while (i < n && text[i] !== '\n') i++
        continue
      }
      break
    }
  }

  function readQuotedString(): string {
    i++ // opening quote
    let out = ''
    while (i < n && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < n) {
        out += text[i + 1]
        i += 2
      } else {
        out += text[i]
        i++
      }
    }
    i++ // closing quote
    return out
  }

  function readToken(): string {
    let out = ''
    while (i < n && !/[\s{}"]/.test(text[i])) {
      out += text[i]
      i++
    }
    return out
  }

  function parseObject(): VdfObject {
    const obj: VdfObject = {}
    for (;;) {
      skipWhitespaceAndComments()
      if (i >= n) break
      if (text[i] === '}') {
        i++
        break
      }
      const key = text[i] === '"' ? readQuotedString() : readToken()
      skipWhitespaceAndComments()
      if (i >= n) break
      if (text[i] === '{') {
        i++
        obj[key] = parseObject()
      } else if (text[i] === '"') {
        obj[key] = readQuotedString()
      } else {
        obj[key] = readToken()
      }
    }
    return obj
  }

  skipWhitespaceAndComments()
  return parseObject()
}
