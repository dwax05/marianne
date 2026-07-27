import { wcagContrast } from 'culori'
import type { ContrastFix, Hex, Palette, Swatch, WcagLevel } from './types'
import { FOREGROUND_ROLES } from './types'
import { toOklch, toHex } from './convert'

export const AA_NORMAL = 4.5
const AA_LARGE = 3
const AAA_NORMAL = 7

/** WCAG 2.x contrast ratio between two colors (1..21). */
export function contrast(a: Hex, b: Hex): number {
  return wcagContrast(a, b)
}

/** Grade a ratio into the strongest level it satisfies. */
export function grade(ratio: number): WcagLevel {
  if (ratio >= AAA_NORMAL) return 'AAA'
  if (ratio >= AA_NORMAL) return 'AA'
  if (ratio >= AA_LARGE) return 'AA-large'
  return 'fail'
}

export interface ContrastPair {
  fg: Swatch
  bg: Swatch
  ratio: number
  level: WcagLevel
}

/**
 * Meaningful contrast pairs based on roles: each foreground role
 * (text, brand, and accent roles) against each background. Returns a signal via
 * `hasBackground` so the UI can prompt the user to assign roles.
 */
export function rolePairs(palette: Palette): {
  pairs: ContrastPair[]
  hasBackground: boolean
} {
  const backgrounds = palette.filter((s) => s.role === 'background')
  const foregrounds = palette.filter((s) => FOREGROUND_ROLES.includes(s.role))
  const pairs: ContrastPair[] = []
  for (const bg of backgrounds) {
    for (const fg of foregrounds) {
      const ratio = contrast(fg.hex, bg.hex)
      pairs.push({ fg, bg, ratio, level: grade(ratio) })
    }
  }
  pairs.sort((a, b) => a.ratio - b.ratio)
  return { pairs, hasBackground: backgrounds.length > 0 }
}

/**
 * Nudge `fg`'s OKLCH lightness until it meets `target` contrast against `bg`.
 * Tries both darker and lighter directions, returns whichever reaches target
 * with the smaller lightness change. Returns null if neither direction can.
 */
export function suggestContrastFix(
  fg: Hex,
  bg: Hex,
  target = AA_NORMAL,
): ContrastFix | null {
  if (contrast(fg, bg) >= target) {
    return { hex: fg, ratio: contrast(fg, bg), deltaL: 0 }
  }
  const base = toOklch(fg)
  if (!base) return null

  const down = searchLightness(base, bg, target, -1)
  const up = searchLightness(base, bg, target, +1)

  const candidates = [down, up].filter((x): x is ContrastFix => x !== null)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => Math.abs(a.deltaL) - Math.abs(b.deltaL))
  return candidates[0]
}

/** Binary-search lightness in one direction for the closest color hitting target. */
function searchLightness(
  base: { l: number; c: number; h: number },
  bg: Hex,
  target: number,
  dir: -1 | 1,
): ContrastFix | null {
  const bound = dir === -1 ? 0 : 1
  // Verify the extreme end can actually reach the target.
  const extremeHex = toHex({ ...base, l: bound })
  if (contrast(extremeHex, bg) < target) return null

  let lo = base.l
  let hi = bound
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const hex = toHex({ ...base, l: mid })
    if (contrast(hex, bg) >= target) {
      hi = mid
    } else {
      lo = mid
    }
  }
  const hex = toHex({ ...base, l: hi })
  return { hex, ratio: contrast(hex, bg), deltaL: hi - base.l }
}
