import { differenceCiede2000 } from 'culori'
import type { Hex, HarmonySet, Oklch } from './types'
import { toOklch, toHex } from './convert'

const deltaE = differenceCiede2000()
/** Below this CIEDE2000 distance two colors read as the same. */
const SAME_COLOR = 6

export type RandomHarmonyScheme =
  | 'Analogous'
  | 'Triadic'
  | 'Split complementary'

export interface RandomHarmonyPalette {
  scheme: RandomHarmonyScheme
  baseHex: Hex
  colors: Hex[]
}

const RANDOM_SCHEMES: Array<{
  label: RandomHarmonyScheme
  offsets: readonly number[]
}> = [
  { label: 'Analogous', offsets: [-30, 0, 30] },
  { label: 'Triadic', offsets: [0, 120, 240] },
  { label: 'Split complementary', offsets: [0, 150, 210] },
]

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

/**
 * Build a five-color starter palette from a random display-safe OKLCH base:
 * two subtly tinted neutral anchors plus a three-color classic harmony.
 * Accepting an RNG keeps the algorithm deterministic in tests.
 */
export function randomHarmonyPalette(
  random: () => number = Math.random,
): RandomHarmonyPalette {
  const hue = randomUnit(random) * 360
  const base: Oklch = {
    l: 0.52 + randomUnit(random) * 0.16,
    c: 0.13 + randomUnit(random) * 0.08,
    h: hue,
  }
  const scheme = RANDOM_SCHEMES[
    Math.floor(randomUnit(random) * RANDOM_SCHEMES.length)
  ]
  const baseHex = toHex(base)

  return {
    scheme: scheme.label,
    baseHex,
    colors: [
      toHex({ l: 0.965, c: 0.012, h: (hue + 20) % 360 }),
      toHex({ l: 0.2, c: 0.02, h: hue }),
      ...scheme.offsets.map((offset) => rotate(base, offset)),
    ],
  }
}

function randomUnit(random: () => number): number {
  const value = random()
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1 - Number.EPSILON, Math.max(0, value))
}
