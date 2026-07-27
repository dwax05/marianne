import type { Hex, Oklch, Palette } from './types'
import { toHex, toOklch } from './convert'

export const NEUTRAL_CHROMA_MAX = 0.04
export const DARK_NEUTRAL_LIGHTNESS_MAX = 0.3
export const LIGHT_NEUTRAL_LIGHTNESS_MIN = 0.88

export type NeutralTone = 'light' | 'dark'

export interface PaletteCoverage {
  hasLightNeutral: boolean
  hasDarkNeutral: boolean
}

export interface HarmonyIssue {
  id: string
  kind: 'saturation' | 'lightness'
  swatchId: string
  currentHex: Hex
  suggestedHex: Hex
  title: string
  description: string
  locked: boolean
}

interface MeasuredSwatch {
  swatch: Palette[number]
  color: Oklch
}

/** Check whether the palette has quiet colors at both ends of its tonal range. */
export function analyzeCoverage(palette: Palette): PaletteCoverage {
  const colors = palette
    .map((swatch) => toOklch(swatch.hex))
    .filter((color): color is Oklch => color !== null)

  return {
    hasLightNeutral: colors.some(
      (color) =>
        color.c <= NEUTRAL_CHROMA_MAX &&
        color.l >= LIGHT_NEUTRAL_LIGHTNESS_MIN,
    ),
    hasDarkNeutral: colors.some(
      (color) =>
        color.c <= NEUTRAL_CHROMA_MAX &&
        color.l <= DARK_NEUTRAL_LIGHTNESS_MAX,
    ),
  }
}

/**
 * Build a quiet neutral that is subtly tinted toward the palette's weighted
 * average hue. This keeps suggested neutrals from feeling generic or pasted in.
 */
export function suggestNeutral(palette: Palette, tone: NeutralTone): Hex {
  const measured = measure(palette).filter(
    ({ color }) => color.c > NEUTRAL_CHROMA_MAX,
  )
  const h = averageHue(measured)
  const averageChroma = measured.length
    ? measured.reduce((sum, { color }) => sum + color.c, 0) / measured.length
    : 0.08
  const c = clamp(averageChroma * 0.14, 0.008, tone === 'light' ? 0.018 : 0.024)
  return toHex({
    l: tone === 'light' ? 0.965 : 0.235,
    c,
    h,
  })
}

/**
 * Find colors whose chroma or lightness breaks sharply from the palette's
 * otherwise consistent cluster. Median/MAD thresholds make this robust to one
 * extreme value and avoid treating an intentional ramp as an error.
 */
export function analyzeHarmony(palette: Palette): HarmonyIssue[] {
  const chromatic = measure(palette).filter(
    ({ color }) => color.c > NEUTRAL_CHROMA_MAX,
  )
  if (chromatic.length < 3) return []

  const issues: HarmonyIssue[] = []
  const chromas = chromatic.map(({ color }) => color.c)
  const medianChroma = median(chromas)
  const chromaMad = median(chromas.map((value) => Math.abs(value - medianChroma)))
  const chromaThreshold = medianChroma + Math.max(0.045, chromaMad * 2.5)
  const saturationOutliers = new Set<string>()

  for (const { swatch, color } of chromatic) {
    if (color.c <= chromaThreshold) continue
    saturationOutliers.add(swatch.id)
    issues.push({
      id: `saturation:${swatch.id}:${swatch.hex.toLowerCase()}`,
      kind: 'saturation',
      swatchId: swatch.id,
      currentHex: swatch.hex,
      suggestedHex: toHex({ ...color, c: medianChroma }),
      title: 'Too vibrant compared to palette',
      description:
        'Adjust saturation to harmonize with the palette while preserving hue and lightness.',
      locked: swatch.locked,
    })
  }

  // Do not let an extreme saturation outlier distort the lightness cluster or
  // produce two simultaneous fixes for the same color. Lightness is only
  // compared among colors with similar chroma character: a muted tonal bridge
  // should not be judged as though it were one of the palette's vivid accents.
  const comparableChromaMin = Math.max(
    NEUTRAL_CHROMA_MAX,
    medianChroma * 0.7,
  )
  const lightnessCandidates = chromatic.filter(
    ({ swatch, color }) =>
      !saturationOutliers.has(swatch.id) && color.c >= comparableChromaMin,
  )
  if (lightnessCandidates.length < 4) return issues

  const lightnesses = lightnessCandidates.map(({ color }) => color.l)
  const medianLightness = median(lightnesses)
  const lightnessMad = median(
    lightnesses.map((value) => Math.abs(value - medianLightness)),
  )
  const lightnessThreshold = Math.max(0.05, lightnessMad * 2.75)

  for (const { swatch, color } of lightnessCandidates) {
    const delta = color.l - medianLightness
    if (Math.abs(delta) <= lightnessThreshold) continue
    const brighter = delta > 0
    issues.push({
      id: `lightness:${swatch.id}:${swatch.hex.toLowerCase()}`,
      kind: 'lightness',
      swatchId: swatch.id,
      currentHex: swatch.hex,
      suggestedHex: toHex({ ...color, l: medianLightness }),
      title: `Too ${brighter ? 'bright' : 'dark'} compared to palette`,
      description: `Adjust lightness to harmonize with the palette's main color cluster.`,
      locked: swatch.locked,
    })
  }

  return issues
}

/** Apply a group of harmony fixes while respecting locked swatches. */
export function applyHarmonyFixes(
  palette: Palette,
  issues: HarmonyIssue[],
): Palette {
  const fixes = new Map(
    issues
      .filter((issue) => !issue.locked)
      .map((issue) => [issue.swatchId, issue.suggestedHex]),
  )
  return palette.map((swatch) => {
    const hex = fixes.get(swatch.id)
    return hex ? { ...swatch, hex } : swatch
  })
}

function measure(palette: Palette): MeasuredSwatch[] {
  return palette
    .map((swatch) => ({ swatch, color: toOklch(swatch.hex) }))
    .filter(
      (entry): entry is MeasuredSwatch => entry.color !== null,
    )
}

function averageHue(colors: MeasuredSwatch[]): number {
  if (colors.length === 0) return 75
  let x = 0
  let y = 0
  for (const { color } of colors) {
    const radians = (color.h * Math.PI) / 180
    x += Math.cos(radians) * color.c
    y += Math.sin(radians) * color.c
  }
  const degrees = (Math.atan2(y, x) * 180) / Math.PI
  return (degrees + 360) % 360
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
