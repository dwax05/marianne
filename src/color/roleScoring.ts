import { NEUTRAL_CHROMA_MAX } from './audit'
import { contrast } from './contrast'
import { toOklch } from './convert'
import { clamp01 } from '../lib/num'
import type { Oklch, Palette, Swatch } from './types'
import type { AssignableRole, RoleCandidate, RoleConfidence } from './roles'

/**
 * The scalar scoring engine behind role suggestion: it turns swatches into
 * measured features and grades each candidate role from tuning constants. It is
 * deliberately free of the uniqueness bitmask and assignment search (those live
 * in `roles.ts`), so this layer only ever reads features — never the plan.
 */

export const HIGH_CONFIDENCE_SCORE_MIN = 0.75
export const HIGH_CONFIDENCE_MARGIN_MIN = 0.2
export const MEDIUM_CONFIDENCE_SCORE_MIN = 0.55
export const MEDIUM_CONFIDENCE_MARGIN_MIN = 0.1

export const SCORE_EPSILON = 1e-9
export const ACCESSIBILITY_QUALITY_BONUS = 0.08
export const LOW_CONFIDENCE_QUALITY_PENALTY = 0.08

const LIGHT_BACKGROUND_TARGET = 0.96
const DARK_BACKGROUND_TARGET = 0.1
const LIGHT_NEUTRAL_TARGET = 0.93
const DARK_NEUTRAL_TARGET = 0.18
const LIGHT_ACCENT_TARGET = 0.82
const DARK_ACCENT_TARGET = 0.34
const MIDDLE_TONE_TARGET = 0.56
const TONAL_SPREAD = 0.62
const NEUTRAL_CHROMA_FADE = NEUTRAL_CHROMA_MAX * 3

const BACKGROUND_WEIGHTS = {
  neutral: 0.42,
  tone: 0.4,
  readablePartner: 0.18,
} as const

const TEXT_WEIGHTS = {
  contrast: 0.68,
  neutral: 0.22,
  tone: 0.1,
} as const

const NEUTRAL_WEIGHTS = {
  neutral: 0.65,
  tone: 0.35,
} as const

const PRIMARY_WEIGHTS = {
  chroma: 0.42,
  tone: 0.28,
  contrast: 0.3,
} as const

const HERO_WEIGHTS = {
  salience: 0.42,
  chroma: 0.28,
  contrast: 0.22,
  tone: 0.08,
} as const

const ACCENT_WEIGHTS = {
  chroma: 0.38,
  hueSeparation: 0.3,
  contrast: 0.22,
  tone: 0.1,
} as const

const ACCENT_VARIANT_WEIGHTS = {
  hueAffinity: 0.36,
  tone: 0.34,
  chroma: 0.18,
  contrast: 0.12,
} as const

const GENERIC_NEUTRAL_WEIGHTS = {
  neutral: 0.62,
  tone: 0.38,
} as const

export const ROLE_ORDER: readonly AssignableRole[] = [
  'background',
  'text',
  'primary',
  'hero',
  'accent',
  'light-accent',
  'dark-accent',
  'light-neutral',
  'dark-neutral',
  'neutral',
]

export interface MeasuredSwatch {
  swatch: Swatch
  index: number
  color: Oklch | null
  neutralness: number
  relativeChroma: number
  salience: number
}

export interface ScoringContext {
  orientation: 'light' | 'dark'
  measured: MeasuredSwatch[]
  backgrounds: MeasuredSwatch[]
  anchors: MeasuredSwatch[]
  occupiedExplicit: Set<AssignableRole>
}

export function measurePalette(palette: Palette): MeasuredSwatch[] {
  const parsed = palette.map((swatch, index) => ({
    swatch,
    index,
    color: toOklch(swatch.hex),
  }))
  const valid = parsed.filter(
    (entry): entry is typeof entry & { color: Oklch } => entry.color !== null,
  )
  const maxChroma = Math.max(0, ...valid.map(({ color }) => color.c))
  const meanLightness = valid.length
    ? valid.reduce((sum, { color }) => sum + color.l, 0) / valid.length
    : 0.5

  return parsed.map((entry) => {
    if (!entry.color) {
      return {
        ...entry,
        neutralness: 0,
        relativeChroma: 0,
        salience: 0,
      }
    }
    const relativeChroma = maxChroma > 0 ? entry.color.c / maxChroma : 0
    const lightnessDistance = clamp01(Math.abs(entry.color.l - meanLightness) * 2)
    return {
      ...entry,
      neutralness: clamp01(1 - entry.color.c / NEUTRAL_CHROMA_FADE),
      relativeChroma,
      salience: clamp01(relativeChroma * 0.72 + lightnessDistance * 0.28),
    }
  })
}

export function scoreRole(
  entry: MeasuredSwatch,
  role: AssignableRole,
  context: ScoringContext,
): RoleCandidate {
  if (!entry.color) return invalidFallback(role === 'accent' ? 'accent' : 'neutral')

  const color = entry.color
  const contrastValue = contrastFeature(entry, context.backgrounds)
  const middleTone = tonalProximity(color.l, MIDDLE_TONE_TARGET)
  const lightTone = tonalProximity(color.l, LIGHT_NEUTRAL_TARGET)
  const darkTone = tonalProximity(color.l, DARK_NEUTRAL_TARGET)
  const hueSeparation = anchorSeparation(entry, context.anchors)
  const hueAffinity = 1 - hueSeparation
  let score = 0
  let reason = ''

  switch (role) {
    case 'background': {
      score = backgroundScore(entry, context.orientation, context.measured)
      const tone = context.orientation === 'light' ? 'light' : 'dark'
      reason =
        entry.neutralness >= tonalProximity(
          color.l,
          context.orientation === 'light'
            ? LIGHT_BACKGROUND_TARGET
            : DARK_BACKGROUND_TARGET,
        )
          ? `Its quiet chroma makes it a stable ${tone} background.`
          : `Its ${tone} tonal extreme leaves room for a readable foreground.`
      break
    }
    case 'text':
      score =
        contrastValue * TEXT_WEIGHTS.contrast +
        entry.neutralness * TEXT_WEIGHTS.neutral +
        tonalProximity(
          color.l,
          context.orientation === 'light' ? 0.16 : 0.9,
        ) *
          TEXT_WEIGHTS.tone
      reason =
        context.backgrounds.length > 1
          ? 'It keeps the strongest worst-case contrast across all backgrounds.'
          : 'It provides the strongest readable contrast against the background.'
      break
    case 'light-neutral':
      score =
        entry.neutralness * NEUTRAL_WEIGHTS.neutral +
        lightTone * NEUTRAL_WEIGHTS.tone
      reason = 'Its low chroma and light tone make a quiet surface neutral.'
      break
    case 'dark-neutral':
      score =
        entry.neutralness * NEUTRAL_WEIGHTS.neutral +
        darkTone * NEUTRAL_WEIGHTS.tone
      reason = 'Its low chroma and dark tone make a grounded neutral anchor.'
      break
    case 'neutral':
      score =
        entry.neutralness * GENERIC_NEUTRAL_WEIGHTS.neutral +
        middleTone * GENERIC_NEUTRAL_WEIGHTS.tone
      reason = 'Its low chroma and middle tone suit a reusable neutral role.'
      break
    case 'primary':
      score =
        entry.relativeChroma * PRIMARY_WEIGHTS.chroma +
        middleTone * PRIMARY_WEIGHTS.tone +
        contrastValue * PRIMARY_WEIGHTS.contrast
      reason =
        entry.relativeChroma >= contrastValue
          ? 'Its strong chroma gives the palette a clear primary color.'
          : 'Its chroma and background contrast make it a useful primary color.'
      break
    case 'hero':
      score =
        entry.salience * HERO_WEIGHTS.salience +
        entry.relativeChroma * HERO_WEIGHTS.chroma +
        contrastValue * HERO_WEIGHTS.contrast +
        middleTone * HERO_WEIGHTS.tone
      reason = 'Its visual salience makes it the palette’s strongest hero color.'
      break
    case 'accent':
      score =
        entry.relativeChroma * ACCENT_WEIGHTS.chroma +
        hueSeparation * ACCENT_WEIGHTS.hueSeparation +
        contrastValue * ACCENT_WEIGHTS.contrast +
        middleTone * ACCENT_WEIGHTS.tone
      reason = context.anchors.length
        ? 'Its chroma and hue separation help it stand apart from the brand colors.'
        : 'Its chroma makes it a flexible reusable accent.'
      break
    case 'light-accent':
      score =
        hueAffinity * ACCENT_VARIANT_WEIGHTS.hueAffinity +
        tonalProximity(color.l, LIGHT_ACCENT_TARGET) *
          ACCENT_VARIANT_WEIGHTS.tone +
        entry.relativeChroma * ACCENT_VARIANT_WEIGHTS.chroma +
        contrastValue * ACCENT_VARIANT_WEIGHTS.contrast
      reason = context.anchors.length
        ? 'Its light tone stays close in hue to the nearest brand anchor.'
        : 'Its light tone and chroma make a useful accent variant.'
      break
    case 'dark-accent':
      score =
        hueAffinity * ACCENT_VARIANT_WEIGHTS.hueAffinity +
        tonalProximity(color.l, DARK_ACCENT_TARGET) *
          ACCENT_VARIANT_WEIGHTS.tone +
        entry.relativeChroma * ACCENT_VARIANT_WEIGHTS.chroma +
        contrastValue * ACCENT_VARIANT_WEIGHTS.contrast
      reason = context.anchors.length
        ? 'Its dark tone stays close in hue to the nearest brand anchor.'
        : 'Its dark tone and chroma make a useful accent variant.'
      break
  }

  return { role, score: roundScore(clamp01(score)), reason }
}

export function backgroundScore(
  entry: MeasuredSwatch,
  orientation: 'light' | 'dark',
  measured: MeasuredSwatch[],
): number {
  if (!entry.color) return 0
  const target =
    orientation === 'light' ? LIGHT_BACKGROUND_TARGET : DARK_BACKGROUND_TARGET
  const readablePartner = measured
    .filter(
      (other) =>
        other.color !== null &&
        other.swatch.id !== entry.swatch.id &&
        (other.swatch.role !== 'unset' || !other.swatch.locked),
    )
    .reduce(
      (best, other) => Math.max(best, contrastScore(other.swatch.hex, entry.swatch.hex)),
      0,
    )
  return clamp01(
    entry.neutralness * BACKGROUND_WEIGHTS.neutral +
      tonalProximity(entry.color.l, target) * BACKGROUND_WEIGHTS.tone +
      readablePartner * BACKGROUND_WEIGHTS.readablePartner,
  )
}

export function textScore(
  entry: MeasuredSwatch,
  backgrounds: MeasuredSwatch[],
  orientation: 'light' | 'dark',
): number {
  if (!entry.color) return 0
  return clamp01(
    contrastFeature(entry, backgrounds) * TEXT_WEIGHTS.contrast +
      entry.neutralness * TEXT_WEIGHTS.neutral +
      tonalProximity(entry.color.l, orientation === 'light' ? 0.16 : 0.9) *
        TEXT_WEIGHTS.tone,
  )
}

function contrastFeature(
  entry: MeasuredSwatch,
  backgrounds: MeasuredSwatch[],
): number {
  if (!entry.color || backgrounds.length === 0) return 0
  return Math.min(
    ...backgrounds.map((background) =>
      contrastScore(entry.swatch.hex, background.swatch.hex),
    ),
  )
}

function contrastScore(foreground: string, background: string): number {
  const ratio = contrast(foreground, background)
  if (!Number.isFinite(ratio)) return 0
  return clamp01((Math.min(ratio, 7) - 1) / 6)
}

function anchorSeparation(
  entry: MeasuredSwatch,
  anchors: MeasuredSwatch[],
): number {
  if (!entry.color || entry.color.c <= NEUTRAL_CHROMA_MAX || anchors.length === 0) {
    return 0.5
  }
  let nearest = 1
  for (const anchor of anchors) {
    if (!anchor.color || anchor.color.c <= NEUTRAL_CHROMA_MAX) continue
    const separation = circularHueDistance(entry.color.h, anchor.color.h) / 180
    if (separation < nearest - SCORE_EPSILON) nearest = separation
  }
  return nearest
}

function circularHueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360
  return Math.min(delta, 360 - delta)
}

function tonalProximity(lightness: number, target: number): number {
  return clamp01(1 - Math.abs(lightness - target) / TONAL_SPREAD)
}

export function chooseBest(
  entries: MeasuredSwatch[],
  score: (entry: MeasuredSwatch) => number,
): MeasuredSwatch | null {
  let best: MeasuredSwatch | null = null
  let bestScore = -1
  for (const entry of entries) {
    const nextScore = score(entry)
    if (nextScore > bestScore + SCORE_EPSILON) {
      best = entry
      bestScore = nextScore
    }
  }
  return best
}

export function confidenceFor(score: number, margin: number): RoleConfidence {
  if (
    score >= HIGH_CONFIDENCE_SCORE_MIN &&
    margin >= HIGH_CONFIDENCE_MARGIN_MIN
  ) {
    return 'high'
  }
  if (
    score >= MEDIUM_CONFIDENCE_SCORE_MIN &&
    margin >= MEDIUM_CONFIDENCE_MARGIN_MIN
  ) {
    return 'medium'
  }
  return 'low'
}

export function rankedAlternatives(
  candidates: RoleCandidate[],
  recommendedRole: AssignableRole,
): RoleCandidate[] {
  const remaining = candidates.filter(
    (candidate) => candidate.role !== recommendedRole,
  )
  const requiredGeneric = remaining.filter(
    (candidate) => candidate.role === 'accent' || candidate.role === 'neutral',
  )
  const selected = new Map<AssignableRole, RoleCandidate>()
  for (const candidate of requiredGeneric) selected.set(candidate.role, candidate)
  for (const candidate of remaining) {
    if (selected.size >= 3) break
    selected.set(candidate.role, candidate)
  }
  return [...selected.values()].sort(compareCandidates).slice(0, 3)
}

export function compareCandidates(a: RoleCandidate, b: RoleCandidate): number {
  if (Math.abs(b.score - a.score) > SCORE_EPSILON) return b.score - a.score
  return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
}

export function invalidFallback(role: 'accent' | 'neutral'): RoleCandidate {
  return {
    role,
    score: role === 'neutral' ? 0.12 : 0.1,
    reason:
      'The color could not be analyzed, so this is a cautious generic fallback.',
  }
}

export function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000
}
