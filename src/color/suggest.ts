import { converter, differenceCiede2000 } from 'culori'
import type { Hex, Oklch, Palette, Role } from './types'
import { SKELETON_HEX } from './types'
import { analyzeBalance } from './balance'
import {
  analyzeCoverage,
  analyzeHarmony,
  NEUTRAL_CHROMA_MAX,
  representativeChromaticColor,
  suggestNeutral,
} from './audit'
import { normalizeHex, toHex, toOklch } from './convert'
import { AA_NORMAL, contrast, suggestContrastFix } from './contrast'

const perceptualDifference = differenceCiede2000()
const SAME_COLOR_DIFFERENCE = 6

export interface Suggestion {
  kind:
    | 'light-neutral'
    | 'dark-neutral'
    | 'lightness-gap'
    | 'harmony-color'
    | 'wanted-color'
    | 'contrast'
  label: string
  hex: Hex
  reason: string
  role: Role
}

export interface WantedColorRequest {
  color: string
  role?: WantedColorRole
  targetContrastBg?: Hex
  target?: number
}

export type WantedColorRole = Exclude<Role, 'unset'>

const WANTED_COLOR_BRAND_ROLES: Role[] = [
  'primary',
  'hero',
  'accent',
  'light-accent',
  'dark-accent',
]

export type WantedColorSuggestion = Suggestion & {
  kind: 'wanted-color'
  role: WantedColorRole
}

export type WantedColorResult =
  | { status: 'ready'; suggestion: WantedColorSuggestion }
  | { status: 'already-present'; swatchId: string; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'unachievable'; message: string }

/**
 * Preserve a requested color's hue while borrowing the visual weight of the
 * current palette. A string is shorthand for the common accent-color request.
 */
export function suggestWantedColor(
  palette: Palette,
  wanted: string | WantedColorRequest,
): WantedColorResult {
  const request = typeof wanted === 'string' ? { color: wanted } : wanted
  const normalized = normalizeHex(request.color)
  const requested = normalized ? toOklch(normalized) : null
  if (!requested) {
    return {
      status: 'invalid',
      message: `“${request.color}” is not a recognized color.`,
    }
  }
  if (requested.c < 0.001) {
    return {
      status: 'invalid',
      message: `“${request.color}” does not identify a chromatic hue to match.`,
    }
  }

  const role = request.role ?? 'accent'
  const measured = palette
    .map((swatch) => ({ swatch, color: toOklch(swatch.hex) }))
    .filter(
      (
        entry,
      ): entry is { swatch: Palette[number]; color: Oklch } =>
        entry.color !== null && entry.color.c > NEUTRAL_CHROMA_MAX,
    )
  const sameRole = measured.filter(({ swatch }) => swatch.role === role)
  const brandColors = measured.filter(({ swatch }) =>
    WANTED_COLOR_BRAND_ROLES.includes(swatch.role),
  )
  const references = sameRole.length
    ? sameRole
    : brandColors.length
      ? brandColors
      : measured
  const paletteLightness = references.length
    ? median(references.map(({ color }) => color.l))
    : ACCENT_FALLBACK.l
  const paletteChroma = references.length
    ? median(references.map(({ color }) => color.c))
    : ACCENT_FALLBACK.c
  const lightness = wantedRoleLightness(role, paletteLightness)
  const chroma = wantedRoleChroma(role, paletteChroma)
  let hex = toHex({ l: lightness, c: chroma, h: requested.h })
  const requestedLabel = request.color.trim()
  let contrastReason = ''
  if (request.targetContrastBg) {
    const background = normalizeHex(request.targetContrastBg)
    const target = request.target ?? AA_NORMAL
    if (!background || target < 1 || target > 21) {
      return {
        status: 'invalid',
        message: 'The contrast target is not valid.',
      }
    }
    const fix = suggestContrastFix(hex, background, target)
    if (!fix || fix.ratio < target) {
      return {
        status: 'unachievable',
        message: `No matching ${requestedLabel} can reach the requested contrast.`,
      }
    }
    hex = fix.hex
    contrastReason = ` It reaches ${fix.ratio.toFixed(1)}:1 contrast against ${background}.`
  }
  const displayed = toOklch(hex)
  if (
    !displayed ||
    displayed.c < 0.01 ||
    circularHueDistance(displayed.h, requested.h) > 3
  ) {
    return {
      status: 'unachievable',
      message: `No displayable matching ${requestedLabel} can satisfy those constraints without losing its hue.`,
    }
  }
  const duplicate = palette.find((swatch) => {
    const existing = normalizeHex(swatch.hex)
    return (
      existing !== null &&
      perceptualDifference(existing, hex) < SAME_COLOR_DIFFERENCE
    )
  })
  if (duplicate) {
    return {
      status: 'already-present',
      swatchId: duplicate.id,
      message: `A matching ${requestedLabel} is already in the palette.`,
    }
  }

  return {
    status: 'ready',
    suggestion: {
      kind: 'wanted-color',
      label: `Matching ${requestedLabel}`,
      hex,
      reason: `Keeps the requested ${requestedLabel} hue while matching this palette’s typical lightness and chroma.${contrastReason}`,
      role,
    },
  }
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

/** Brand-neutral fallback accent used when the palette has no chromatic anchor. */
const ACCENT_FALLBACK: Oklch = { l: 0.58, c: 0.13, h: 40 }

/**
 * Propose a single color appropriate for `role`, tinted by the rest of the
 * palette. Used to turn a freshly-added skeleton swatch into a real starting
 * point the moment a role is chosen: neutrals become quiet palette-tinted
 * anchors, brand/accent roles become a harmonious analogous color, and
 * foreground roles are nudged to clear AA against the background when there is
 * one. Pure — takes the current palette, returns a hex.
 */
export function suggestForRole(palette: Palette, role: Role): Hex {
  const bg = palette.find((swatch) => swatch.role === 'background')?.hex
  const readable = (hex: Hex): Hex => {
    if (!bg || contrast(hex, bg) >= AA_NORMAL) return hex
    const fix = suggestContrastFix(hex, bg, AA_NORMAL)
    return fix && fix.ratio >= AA_NORMAL ? fix.hex : hex
  }

  switch (role) {
    case 'background':
    case 'light-neutral':
      return suggestNeutral(palette, 'light')
    case 'dark-neutral':
      return suggestNeutral(palette, 'dark')
    case 'text':
      return readable(suggestNeutral(palette, 'dark'))
    case 'neutral': {
      const anchor = representativeChromaticColor(palette)
      return toHex({ l: 0.6, c: 0.02, h: anchor?.color.h ?? 45 })
    }
    case 'primary':
    case 'hero':
    case 'accent':
    case 'light-accent':
    case 'dark-accent': {
      const anchor = representativeChromaticColor(palette)
      const seed = anchor?.color ?? ACCENT_FALLBACK
      const h = anchor ? analogousHue(palette, seed.h) : seed.h
      const c = Math.max(seed.c, 0.1)
      const l =
        role === 'light-accent'
          ? Math.max(seed.l, 0.82)
          : role === 'dark-accent'
            ? Math.min(seed.l, 0.42)
            : seed.l
      const hex = toHex({ l, c, h })
      // Light/dark accents are decorative variants — keep their tonal intent;
      // the main brand/accent roles sit on the background, so keep them legible.
      return role === 'light-accent' || role === 'dark-accent'
        ? hex
        : readable(hex)
    }
    case 'unset':
    default:
      return SKELETON_HEX
  }
}

/**
 * Rotate `baseHue` by ±30° toward whichever analogous side is least crowded by
 * the palette's existing chromatic hues.
 */
function analogousHue(palette: Palette, baseHue: number): number {
  const hues = palette
    .map((swatch) => toOklch(swatch.hex))
    .filter(
      (color): color is Oklch => color !== null && color.c > NEUTRAL_CHROMA_MAX,
    )
    .map((color) => color.h)
  const offsets = [-ANALOGOUS_HUE_STEP, ANALOGOUS_HUE_STEP] as const
  let selected = offsets[0]
  let bestSeparation = -1
  for (const offset of offsets) {
    const hue = (baseHue + offset + 360) % 360
    const separation = hues.length
      ? Math.min(...hues.map((existing) => circularHueDistance(hue, existing)))
      : Number.POSITIVE_INFINITY
    if (separation > bestSeparation + 1e-9) {
      selected = offset
      bestSeparation = separation
    }
  }
  return (baseHue + selected + 360) % 360
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function wantedRoleLightness(
  role: WantedColorRole,
  paletteLightness: number,
): number {
  switch (role) {
    case 'background':
    case 'light-neutral':
      return Math.max(paletteLightness, 0.9)
    case 'light-accent':
      return Math.max(paletteLightness, 0.82)
    case 'text':
    case 'dark-neutral':
      return Math.min(paletteLightness, 0.3)
    case 'dark-accent':
      return Math.min(paletteLightness, 0.42)
    default:
      return paletteLightness
  }
}

function wantedRoleChroma(role: WantedColorRole, paletteChroma: number): number {
  switch (role) {
    case 'background':
    case 'text':
    case 'neutral':
    case 'light-neutral':
    case 'dark-neutral':
      return Math.min(paletteChroma, 0.035)
    default:
      return paletteChroma
  }
}
