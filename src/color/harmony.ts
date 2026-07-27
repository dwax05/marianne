import { differenceCiede2000 } from 'culori'
import type { Hex, HarmonySet, Oklch } from './types'
import { toOklch, toHex } from './convert'

const deltaE = differenceCiede2000()
/** Below this CIEDE2000 distance two colors read as the same. */
const SAME_COLOR = 6

function rotate(base: Oklch, deg: number): Hex {
  return toHex({ ...base, h: (base.h + deg + 360) % 360 })
}

/** Vary lightness while keeping hue + chroma, clamped to gamut. */
function lightnessRamp(base: Oklch, count: number): Hex[] {
  const out: Hex[] = []
  for (let i = 0; i < count; i++) {
    const l = (i + 1) / (count + 1) // spread across 0..1, excluding extremes
    out.push(toHex({ ...base, l }))
  }
  return out
}

/**
 * Classic color-wheel harmonies computed by rotating hue in OKLCH.
 * Each set includes the base color first. Returns hex arrays.
 */
export function harmonies(baseHex: Hex): HarmonySet | null {
  const base = toOklch(baseHex)
  if (!base) return null
  const b = toHex(base)

  return {
    complementary: [b, rotate(base, 180)],
    analogous: [rotate(base, -30), b, rotate(base, 30)],
    triadic: [b, rotate(base, 120), rotate(base, 240)],
    tetradic: [b, rotate(base, 90), rotate(base, 180), rotate(base, 270)],
    splitComplementary: [b, rotate(base, 150), rotate(base, 210)],
    monochromatic: lightnessRamp(base, 5),
  }
}

const HARMONY_KEYS: (keyof HarmonySet)[] = [
  'complementary',
  'analogous',
  'triadic',
  'tetradic',
  'splitComplementary',
  'monochromatic',
]

/**
 * Round-robin interleave arrays, dropping colors that are perceptually
 * indistinguishable (CIEDE2000 < SAME_COLOR) from one already kept.
 */
function interleave(lists: Hex[][]): Hex[] {
  const out: Hex[] = []
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      const hex = list[i]
      if (!hex) continue
      if (out.some((kept) => deltaE(kept, hex) < SAME_COLOR)) continue
      out.push(hex)
    }
  }
  return out
}

/**
 * Blend several base colors: for each harmony type, compute each base's set
 * and interleave them into one combined palette. Invalid bases are skipped;
 * returns null if none are valid.
 */
export function combinedHarmonies(baseHexes: Hex[]): HarmonySet | null {
  const sets = baseHexes
    .map((h) => harmonies(h))
    .filter((s): s is HarmonySet => !!s)
  if (sets.length === 0) return null

  const out = {} as HarmonySet
  for (const key of HARMONY_KEYS) {
    out[key] = interleave(sets.map((s) => s[key]))
  }
  return out
}
