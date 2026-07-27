import { converter } from 'culori'
import type { Hex, Palette, Role } from './types'
import { analyzeBalance } from './balance'
import {
  analyzeCoverage,
  analyzeHarmony,
  NEUTRAL_CHROMA_MAX,
  representativeChromaticColor,
  suggestNeutral,
} from './audit'
import { toHex, toOklch } from './convert'
import { AA_NORMAL, contrast, suggestContrastFix } from './contrast'

export interface Suggestion {
  kind:
    | 'light-neutral'
    | 'dark-neutral'
    | 'lightness-gap'
    | 'harmony-color'
    | 'contrast'
  label: string
  hex: Hex
  reason: string
  role: Role
}

/**
 * Propose useful additions:
 *  - supply missing light and dark neutrals,
 *  - fill a genuinely large lightness gap, and
 *  - add an analogous accent on the palette's less crowded hue side, and
 *  - if a background is given, guarantee at least one AA-passing color
 *    against it (fixing the closest existing color if none passes).
 */
export function suggestAdditions(
  palette: Palette,
  opts: { targetContrastBg?: Hex; target?: number } = {},
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const { targetContrastBg, target = AA_NORMAL } = opts

  // 1. Supply neutral anchors tinted toward the palette's average hue.
  const coverage = analyzeCoverage(palette)
  if (!coverage.hasLightNeutral) {
    suggestions.push({
      kind: 'light-neutral',
      label: 'Light neutral',
      hex: suggestNeutral(palette, 'light'),
      reason: 'A quiet, palette-tinted surface color for backgrounds and breathing room.',
      role: 'light-neutral',
    })
  }
  if (!coverage.hasDarkNeutral) {
    suggestions.push({
      kind: 'dark-neutral',
      label: 'Dark neutral',
      hex: suggestNeutral(palette, 'dark'),
      reason: 'A grounded, palette-tinted anchor for text and deep surfaces.',
      role: 'dark-neutral',
    })
  }

  // 2. Fill a conspicuously large lightness gap with a midpoint color. Judge
  //    gaps among the chromatic swatches only — the same set the Balance score
  //    measures — so a bridge never targets the (intentional) gap around a
  //    neutral anchor and then reads as a balance outlier.
  const report = analyzeBalance(palette)
  const chromaticSteps = report.steps.filter((s) => s.c > NEUTRAL_CHROMA_MAX)
  if (chromaticSteps.length >= 2) {
    let maxGap = 0
    let at = -1
    for (let i = 1; i < chromaticSteps.length; i++) {
      const gap = chromaticSteps[i].l - chromaticSteps[i - 1].l
      if (gap > maxGap) {
        maxGap = gap
        at = i
      }
    }
    if (at > 0 && maxGap >= 0.22) {
      const a = chromaticSteps[at - 1]
      const b = chromaticSteps[at]
      const midHex = toHex({
        l: (a.l + b.l) / 2,
        c: (a.c + b.c) / 2,
        h: a.h, // keep the lower swatch's hue; simple + predictable
      })
      const mid = toOklch(midHex)!
      const role = bridgeRole(mid.l, mid.c)
      if (
        !introducesHarmonyIssue(palette, midHex, role) &&
        !worsensBalance(palette, midHex, role)
      ) {
        suggestions.push({
          kind: 'lightness-gap',
          label: 'Tonal bridge',
          hex: midHex,
          reason: `Fills the largest lightness gap (${(maxGap * 100).toFixed(0)}%).`,
          role,
        })
      }
    }
  }

  // 3. Add a harmonious accent from the palette's representative color. HSL
  //    preserves the anchor's visual weight while a ±30° hue step creates the
  //    familiar analogous relationship. Prefer the less crowded side.
  const harmony = suggestHarmonyColor(palette)
  if (harmony) suggestions.push(harmony)

  // 4. Ensure the current or proposed palette passes AA against the background.
  if (targetContrastBg) {
    const passes = [...palette.map((s) => s.hex), ...suggestions.map((s) => s.hex)]
      .some((hex) => contrast(hex, targetContrastBg) >= target)
    if (!passes) {
      // Fix the palette color closest to already passing.
      const sorted = [...palette].sort(
        (a, b) =>
          contrast(b.hex, targetContrastBg) - contrast(a.hex, targetContrastBg),
      )
      const seed = sorted[0]?.hex ?? toHex({ l: 0.2, c: 0.05, h: 0 })
      const fix = suggestContrastFix(seed, targetContrastBg, target)
      if (fix) {
        suggestions.push({
          kind: 'contrast',
          label: 'Accessible contrast',
          hex: fix.hex,
          reason: `No color meets AA against the background; this one reaches ${fix.ratio.toFixed(1)}:1.`,
          role: 'text',
        })
      }
    }
  }

  return suggestions
}

const toHslColor = converter('hsl')
const toRgbColor = converter('rgb')
const ANALOGOUS_HUE_STEP = 30

function suggestHarmonyColor(palette: Palette): Suggestion | null {
  const anchor = representativeChromaticColor(palette)
  if (!anchor) return null
  const anchorHsl = toHslColor(anchor.swatch.hex)
  if (!anchorHsl || anchorHsl.h === undefined) return null

  const paletteHues = palette
    .map((swatch) => toHslColor(swatch.hex))
    .filter(
      (color): color is NonNullable<typeof color> =>
        color !== undefined &&
        color.h !== undefined &&
        (color.s ?? 0) > 0.08,
    )
    .map((color) => color.h!)

  const offsets = [-ANALOGOUS_HUE_STEP, ANALOGOUS_HUE_STEP] as const
  let selectedOffset = offsets[0]
  let bestSeparation = -1
  for (const offset of offsets) {
    const hue = (anchorHsl.h + offset + 360) % 360
    const separation = Math.min(
      ...paletteHues.map((existingHue) =>
        circularHueDistance(hue, existingHue),
      ),
    )
    if (separation > bestSeparation + 1e-9) {
      selectedOffset = offset
      bestSeparation = separation
    }
  }

  const hex = formatHslWithFloor({
    ...anchorHsl,
    h: (anchorHsl.h + selectedOffset + 360) % 360,
  })
  if (!hex || palette.some((swatch) => swatch.hex.toLowerCase() === hex)) {
    return null
  }

  return {
    kind: 'harmony-color',
    label: 'Harmony color',
    hex,
    reason: `Analogous accent to ${anchor.swatch.hex.toLowerCase()} — harmonious and cohesive.`,
    role: 'accent',
  }
}

function formatHslWithFloor(color: ReturnType<typeof toHslColor>): Hex | null {
  if (!color) return null
  const rgb = toRgbColor(color)
  if (!rgb) return null
  const channel = (value = 0) =>
    Math.floor(Math.min(1, Math.max(0, value)) * 255 + 1e-9)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`
}

function circularHueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360
  return Math.min(delta, 360 - delta)
}

/**
 * Never recommend an addition that pushes lightness balance into (or further
 * into) the warning zone — a suggestion should improve health, not cost it.
 */
function worsensBalance(palette: Palette, hex: Hex, role: Role): boolean {
  const before = analyzeBalance(palette).unevenness
  const after = analyzeBalance([
    ...palette,
    { id: '__suggested__', hex, role, locked: false },
  ]).unevenness
  return after >= 0.05 && after > before + 1e-9
}

/** Never recommend an addition that immediately creates a new harmony warning. */
function introducesHarmonyIssue(
  palette: Palette,
  hex: Hex,
  role: Role,
): boolean {
  const existing = new Set(
    analyzeHarmony(palette).map((issue) => `${issue.kind}:${issue.swatchId}`),
  )
  const candidateId = '__suggested__'
  return analyzeHarmony([
    ...palette,
    { id: candidateId, hex, role, locked: false },
  ]).some(
    (issue) =>
      issue.swatchId === candidateId ||
      !existing.has(`${issue.kind}:${issue.swatchId}`),
  )
}

function bridgeRole(l: number, c: number): Role {
  if (c <= NEUTRAL_CHROMA_MAX) {
    if (l >= 0.8) return 'light-neutral'
    if (l <= 0.4) return 'dark-neutral'
    return 'neutral'
  }
  if (l >= 0.8) return 'light-accent'
  if (l <= 0.5) return 'dark-accent'
  return 'accent'
}
