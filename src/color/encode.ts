import type { Palette, Role, Swatch } from './types'
import { normalizeHex } from './convert'

const STORAGE_KEY = 'marianne:palette'
export const EMPTY_PALETTE_CODE = 'empty'
let idCounter = 0

function nextId(): string {
  idCounter += 1
  return `s${Date.now().toString(36)}${idCounter}`
}

const ROLE_TO_CODE: Record<Role, string> = {
  unset: '',
  background: 'b',
  text: 't',
  primary: 'p',
  hero: 'h',
  accent: 'a',
  'light-accent': 'al',
  'dark-accent': 'ad',
  neutral: 'n',
  'light-neutral': 'nl',
  'dark-neutral': 'nd',
}
const CODE_TO_ROLE: Record<string, Role> = {
  b: 'background',
  t: 'text',
  p: 'primary',
  h: 'hero',
  a: 'accent',
  al: 'light-accent',
  ad: 'dark-accent',
  n: 'neutral',
  nl: 'light-neutral',
  nd: 'dark-neutral',
}

/** Build a swatch with a fresh id from any parseable color (or null). */
export function makeSwatch(
  input: string,
  role: Role = 'unset',
  locked = false,
): Swatch | null {
  const hex = normalizeHex(input)
  if (!hex) return null
  return { id: nextId(), hex, role, locked }
}

/**
 * Encode a palette for the URL hash. Each swatch is `<hex>[.<roleCode>][!]`,
 * joined by '-'. Plain hex (unset role, unlocked) stays back-compatible; an
 * explicitly empty palette uses `empty` so it is distinct from no saved state.
 * e.g. "1b1b1f.b-e5484d.t!-2f9e6b"
 */
export function encodePalette(palette: Palette): string {
  if (palette.length === 0) return EMPTY_PALETTE_CODE
  return palette
    .map((s) => {
      let tok = s.hex.replace(/^#/, '')
      const code = ROLE_TO_CODE[s.role]
      if (code) tok += '.' + code
      if (s.locked) tok += '!'
      return tok
    })
    .join('-')
}

/** Decode a hash string back into a palette, dropping invalid tokens. */
export function decodePalette(str: string): Palette {
  if (!str || str === EMPTY_PALETTE_CODE) return []
  return str
    .split('-')
    .map(parseToken)
    .filter((s): s is Swatch => s !== null)
}

function parseToken(raw: string): Swatch | null {
  let tok = raw.trim()
  let locked = false
  if (tok.endsWith('!')) {
    locked = true
    tok = tok.slice(0, -1)
  }
  let role: Role = 'unset'
  const dot = tok.indexOf('.')
  if (dot !== -1) {
    const code = tok.slice(dot + 1)
    role = CODE_TO_ROLE[code] ?? 'unset'
    tok = tok.slice(0, dot)
  }
  const hex = normalizeHex('#' + tok)
  if (!hex) return null
  return { id: nextId(), hex, role, locked }
}

export function saveLocal(palette: Palette): void {
  try {
    localStorage.setItem(STORAGE_KEY, encodePalette(palette))
  } catch {
    // ignore quota / unavailable storage
  }
}

export function loadLocal(): Palette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    if (raw === EMPTY_PALETTE_CODE) return []
    const p = decodePalette(raw)
    return p.length ? p : null
  } catch {
    return null
  }
}
