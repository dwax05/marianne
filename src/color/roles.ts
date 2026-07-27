import { NEUTRAL_CHROMA_MAX } from './audit'
import { AA_NORMAL, contrast } from './contrast'
import { toOklch } from './convert'
import { clamp01 } from '../lib/num'
import type { Oklch, Palette, Role, Swatch } from './types'

type RoleConfidence = 'high' | 'medium' | 'low'
export type AssignableRole = Exclude<Role, 'unset'>

export interface RoleAssignment {
  swatchId: string
  role: AssignableRole
}

export interface RoleCandidate {
  role: AssignableRole
  score: number
  reason: string
}

export interface RoleSuggestion {
  swatchId: string
  recommended: RoleCandidate
  confidence: RoleConfidence
  alternatives: RoleCandidate[]
}

export interface RoleSuggestionSet {
  interpretation: 'light' | 'dark'
  rationale: string
  quality: number
  suggestions: RoleSuggestion[]
}

export const UNIQUE_ASSISTANT_ROLES: readonly AssignableRole[] = [
  'background',
  'text',
  'hero',
  'primary',
  'light-accent',
  'dark-accent',
  'light-neutral',
  'dark-neutral',
]

export const HIGH_CONFIDENCE_SCORE_MIN = 0.75
export const HIGH_CONFIDENCE_MARGIN_MIN = 0.2
export const MEDIUM_CONFIDENCE_SCORE_MIN = 0.55
export const MEDIUM_CONFIDENCE_MARGIN_MIN = 0.1

const LIGHT_BACKGROUND_TARGET = 0.96
const DARK_BACKGROUND_TARGET = 0.1
const LIGHT_NEUTRAL_TARGET = 0.93
const DARK_NEUTRAL_TARGET = 0.18
const LIGHT_ACCENT_TARGET = 0.82
const DARK_ACCENT_TARGET = 0.34
const MIDDLE_TONE_TARGET = 0.56
const TONAL_SPREAD = 0.62
const NEUTRAL_CHROMA_FADE = NEUTRAL_CHROMA_MAX * 3
const SCORE_EPSILON = 1e-9

const ACCESSIBILITY_QUALITY_BONUS = 0.08
const LOW_CONFIDENCE_QUALITY_PENALTY = 0.08

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

const ROLE_ORDER: readonly AssignableRole[] = [
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
const ASSIGNABLE_ROLE_SET = new Set<AssignableRole>(ROLE_ORDER)

const UNIQUE_ROLE_BITS = new Map(
  UNIQUE_ASSISTANT_ROLES.map((role, index) => [role, 1 << index]),
)

interface MeasuredSwatch {
  swatch: Swatch
  index: number
  color: Oklch | null
  neutralness: number
  relativeChroma: number
  salience: number
}

interface ScoringContext {
  orientation: 'light' | 'dark'
  measured: MeasuredSwatch[]
  backgrounds: MeasuredSwatch[]
  anchors: MeasuredSwatch[]
  occupiedExplicit: Set<AssignableRole>
}

interface MappingResult {
  interpretation: 'light' | 'dark'
  rationale: string
  quality: number
  suggestions: RoleSuggestion[]
}

/** Suggest semantic roles without mutating the supplied palette. */
export function suggestRoles(palette: Palette): RoleSuggestionSet {
  const measured = measurePalette(palette)
  const eligible = measured.filter(
    ({ swatch }) => !swatch.locked && swatch.role === 'unset',
  )
  const explicitBackgrounds = measured.filter(
    ({ swatch, color }) => swatch.role === 'background' && color !== null,
  )

  if (palette.some((swatch) => swatch.role === 'background')) {
    const interpretation = orientationFromBackgrounds(explicitBackgrounds)
    return evaluateMapping(
      measured,
      eligible,
      interpretation,
      true,
    )
  }

  const light = evaluateMapping(
    measured,
    eligible,
    'light',
    false,
  )
  const dark = evaluateMapping(
    measured,
    eligible,
    'dark',
    false,
  )

  if (dark.quality > light.quality + SCORE_EPSILON) return dark
  if (Math.abs(light.quality - dark.quality) <= SCORE_EPSILON) {
    return {
      ...light,
      rationale:
        'Light and dark interpretations scored equally, so the light interpretation was selected.',
    }
  }
  return light
}

/**
 * Validate an automatic role batch against the current palette. Existing
 * duplicate roles are tolerated, but no new assignment may claim an occupied
 * unique role or duplicate another assignment target.
 */
export function validateRoleAssignments(
  palette: Palette,
  assignments: readonly RoleAssignment[],
): boolean {
  if (assignments.length === 0) return false

  const byId = new Map(palette.map((swatch) => [swatch.id, swatch]))
  const targetIds = new Set<string>()
  const occupiedUnique = new Set<AssignableRole>()

  for (const swatch of palette) {
    if (
      swatch.role !== 'unset' &&
      isUniqueAssistantRole(swatch.role)
    ) {
      occupiedUnique.add(swatch.role)
    }
  }

  for (const assignment of assignments) {
    if (targetIds.has(assignment.swatchId)) return false
    targetIds.add(assignment.swatchId)

    const target = byId.get(assignment.swatchId)
    if (!target || target.locked || target.role !== 'unset') return false
    if (!ASSIGNABLE_ROLE_SET.has(assignment.role)) return false

    if (isUniqueAssistantRole(assignment.role)) {
      if (occupiedUnique.has(assignment.role)) return false
      occupiedUnique.add(assignment.role)
    }
  }

  return true
}

/** Apply a valid role batch atomically, changing role fields only. */
export function applyRoleAssignments(
  palette: Palette,
  assignments: readonly RoleAssignment[],
): Palette | null {
  if (!validateRoleAssignments(palette, assignments)) return null
  const roles = new Map(
    assignments.map((assignment) => [assignment.swatchId, assignment.role]),
  )
  return palette.map((swatch) => {
    const role = roles.get(swatch.id)
    return role ? { ...swatch, role } : swatch
  })
}

export function isUniqueAssistantRole(
  role: Role,
): role is AssignableRole {
  return role !== 'unset' && UNIQUE_ROLE_BITS.has(role)
}

function evaluateMapping(
  measured: MeasuredSwatch[],
  eligible: MeasuredSwatch[],
  orientation: 'light' | 'dark',
  hasExplicitBackgroundRole: boolean,
): MappingResult {
  const occupiedExplicit = new Set<AssignableRole>()
  for (const { swatch } of measured) {
    if (swatch.role !== 'unset' && isUniqueAssistantRole(swatch.role)) {
      occupiedExplicit.add(swatch.role)
    }
  }

  const assigned = new Map<string, AssignableRole>()
  const validEligible = eligible.filter(({ color }) => color !== null)
  const explicitBackgrounds = measured.filter(
    ({ swatch, color }) => swatch.role === 'background' && color !== null,
  )

  if (!hasExplicitBackgroundRole && !occupiedExplicit.has('background')) {
    const background = chooseBest(
      validEligible,
      (entry) => backgroundScore(entry, orientation, measured),
    )
    if (background) assigned.set(background.swatch.id, 'background')
  }

  const proposedBackground = measured.find(
    ({ swatch }) => assigned.get(swatch.id) === 'background',
  )
  const backgrounds = explicitBackgrounds.length
    ? explicitBackgrounds
    : proposedBackground
      ? [proposedBackground]
      : []

  if (!occupiedExplicit.has('text')) {
    const text = chooseBest(
      validEligible.filter(({ swatch }) => !assigned.has(swatch.id)),
      (entry) => textScore(entry, backgrounds, orientation),
    )
    if (text) assigned.set(text.swatch.id, 'text')
  }

  const preliminaryContext: ScoringContext = {
    orientation,
    measured,
    backgrounds,
    anchors: explicitAnchors(measured),
    occupiedExplicit,
  }

  if (!occupiedExplicit.has('primary')) {
    const primary = chooseBest(
      validEligible.filter(({ swatch }) => !assigned.has(swatch.id)),
      (entry) => scoreRole(entry, 'primary', preliminaryContext).score,
    )
    if (primary) assigned.set(primary.swatch.id, 'primary')
  }

  const primaryAnchors = buildAnchorSet(measured, validEligible, assigned)
  const hasExplicitAccent = measured.some(
    ({ swatch, color }) => swatch.role === 'accent' && color !== null,
  )
  if (!hasExplicitAccent) {
    const accentContext: ScoringContext = {
      ...preliminaryContext,
      anchors: primaryAnchors,
    }
    const accent = chooseBest(
      validEligible.filter(({ swatch }) => !assigned.has(swatch.id)),
      (entry) => scoreRole(entry, 'accent', accentContext).score,
    )
    if (accent) assigned.set(accent.swatch.id, 'accent')
  }

  const anchors = buildAnchorSet(measured, validEligible, assigned)
  const context: ScoringContext = {
    ...preliminaryContext,
    anchors,
  }

  const remaining = eligible.filter(({ swatch }) => !assigned.has(swatch.id))
  const occupiedMask = assignmentMask(occupiedExplicit, assigned)
  const optimized = optimizeAssignments(remaining, context, occupiedMask)
  for (const [swatchId, role] of optimized) assigned.set(swatchId, role)

  const candidatesById = new Map<string, RoleCandidate[]>()
  for (const entry of eligible) {
    candidatesById.set(entry.swatch.id, candidatesFor(entry, context))
  }

  const suggestions = eligible.map((entry) => {
    const role = assigned.get(entry.swatch.id) ?? 'neutral'
    const candidates = candidatesById.get(entry.swatch.id) ?? []
    const recommended =
      candidates.find((candidate) => candidate.role === role) ??
      invalidFallback('neutral')
    const claimedByOthers = new Set<AssignableRole>(occupiedExplicit)
    for (const [swatchId, claimedRole] of assigned) {
      if (swatchId !== entry.swatch.id && isUniqueAssistantRole(claimedRole)) {
        claimedByOthers.add(claimedRole)
      }
    }
    const nextLegal = candidates
      .filter(
        (candidate) =>
          candidate.role !== role &&
          (!isUniqueAssistantRole(candidate.role) ||
            !claimedByOthers.has(candidate.role)),
      )
      .sort(compareCandidates)[0]
    const margin = recommended.score - (nextLegal?.score ?? 0)
    const confidence = entry.color
      ? confidenceFor(recommended.score, margin)
      : 'low'

    return {
      swatchId: entry.swatch.id,
      recommended,
      confidence,
      alternatives: rankedAlternatives(candidates, role),
    }
  })

  const meanScore = suggestions.length
    ? suggestions.reduce(
        (sum, suggestion) => sum + suggestion.recommended.score,
        0,
      ) / suggestions.length
    : 0
  const lowProportion = suggestions.length
    ? suggestions.filter((suggestion) => suggestion.confidence === 'low').length /
      suggestions.length
    : 0
  const accessible = hasAccessibleTextPair(
    measured,
    assigned,
    backgrounds,
  )
  const quality = clamp01(
    meanScore +
      (accessible ? ACCESSIBILITY_QUALITY_BONUS : 0) -
      lowProportion * LOW_CONFIDENCE_QUALITY_PENALTY,
  )

  return {
    interpretation: orientation,
    rationale: hasExplicitBackgroundRole
      ? explicitBackgroundRationale(explicitBackgrounds, orientation)
      : inferredRationale(orientation, accessible),
    quality: roundScore(quality),
    suggestions,
  }
}

function measurePalette(palette: Palette): MeasuredSwatch[] {
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

function candidatesFor(
  entry: MeasuredSwatch,
  context: ScoringContext,
): RoleCandidate[] {
  if (!entry.color) {
    return [invalidFallback('neutral'), invalidFallback('accent')]
  }

  return ROLE_ORDER.filter(
    (role) =>
      !isUniqueAssistantRole(role) || !context.occupiedExplicit.has(role),
  )
    .map((role) => scoreRole(entry, role, context))
    .sort(compareCandidates)
}

function scoreRole(
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

function optimizeAssignments(
  entries: MeasuredSwatch[],
  context: ScoringContext,
  initialMask: number,
): Map<string, AssignableRole> {
  interface SearchResult {
    score: number
    roles: AssignableRole[]
  }
  const memo = new Map<string, SearchResult>()

  const search = (index: number, mask: number): SearchResult => {
    if (index === entries.length) return { score: 0, roles: [] }
    const key = `${index}:${mask}`
    const cached = memo.get(key)
    if (cached) return cached

    const options = candidatesFor(entries[index], context)
    let best: SearchResult | null = null
    for (const option of options) {
      const bit = UNIQUE_ROLE_BITS.get(option.role) ?? 0
      if (bit && (mask & bit) !== 0) continue
      const tail = search(index + 1, bit ? mask | bit : mask)
      const candidate = {
        score: option.score + tail.score,
        roles: [option.role, ...tail.roles],
      }
      if (!best || candidate.score > best.score + SCORE_EPSILON) {
        best = candidate
      }
    }

    const result = best ?? {
      score: 0,
      roles: ['neutral', ...search(index + 1, mask).roles] as AssignableRole[],
    }
    memo.set(key, result)
    return result
  }

  const result = search(0, initialMask)
  return new Map(
    entries.map((entry, index) => [entry.swatch.id, result.roles[index] ?? 'neutral']),
  )
}

function buildAnchorSet(
  measured: MeasuredSwatch[],
  eligible: MeasuredSwatch[],
  assigned: Map<string, AssignableRole>,
): MeasuredSwatch[] {
  const anchors = explicitAnchors(measured)
  const assignedPrimary = eligible.find(
    ({ swatch }) => assigned.get(swatch.id) === 'primary',
  )
  if (assignedPrimary?.color) anchors.push(assignedPrimary)

  const assignedAccent = eligible.find(
    ({ swatch }) => assigned.get(swatch.id) === 'accent',
  )
  if (assignedAccent?.color) anchors.push(assignedAccent)
  return anchors
}

function explicitAnchors(measured: MeasuredSwatch[]): MeasuredSwatch[] {
  return measured.filter(
    ({ swatch, color }) =>
      color !== null &&
      (swatch.role === 'primary' || swatch.role === 'accent'),
  )
}

function backgroundScore(
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

function textScore(
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

function chooseBest(
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

function assignmentMask(
  occupiedExplicit: Set<AssignableRole>,
  assigned: Map<string, AssignableRole>,
): number {
  let mask = 0
  for (const role of occupiedExplicit) mask |= UNIQUE_ROLE_BITS.get(role) ?? 0
  for (const role of assigned.values()) mask |= UNIQUE_ROLE_BITS.get(role) ?? 0
  return mask
}

function confidenceFor(score: number, margin: number): RoleConfidence {
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

function rankedAlternatives(
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

function compareCandidates(a: RoleCandidate, b: RoleCandidate): number {
  if (Math.abs(b.score - a.score) > SCORE_EPSILON) return b.score - a.score
  return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
}

function invalidFallback(role: 'accent' | 'neutral'): RoleCandidate {
  return {
    role,
    score: role === 'neutral' ? 0.12 : 0.1,
    reason:
      'The color could not be analyzed, so this is a cautious generic fallback.',
  }
}

function orientationFromBackgrounds(
  backgrounds: MeasuredSwatch[],
): 'light' | 'dark' {
  if (backgrounds.length === 0) return 'light'
  const lightnesses = backgrounds
    .map(({ color }) => color!.l)
    .sort((a, b) => a - b)
  const middle = Math.floor(lightnesses.length / 2)
  const median =
    lightnesses.length % 2
      ? lightnesses[middle]
      : (lightnesses[middle - 1] + lightnesses[middle]) / 2
  return median >= 0.5 ? 'light' : 'dark'
}

function hasAccessibleTextPair(
  measured: MeasuredSwatch[],
  assigned: Map<string, AssignableRole>,
  backgrounds: MeasuredSwatch[],
): boolean {
  if (backgrounds.length === 0) return false
  const texts = measured.filter(
    ({ swatch, color }) =>
      color !== null &&
      (swatch.role === 'text' || assigned.get(swatch.id) === 'text'),
  )
  if (texts.length === 0) return false
  const ratios = texts.flatMap((text) =>
    backgrounds.map((background) =>
      contrast(text.swatch.hex, background.swatch.hex),
    ),
  )
  return ratios.length > 0 && Math.min(...ratios) >= AA_NORMAL
}

function explicitBackgroundRationale(
  backgrounds: MeasuredSwatch[],
  orientation: 'light' | 'dark',
): string {
  if (backgrounds.length === 0) {
    return `The existing background could not be analyzed, so the ${orientation} interpretation is used cautiously.`
  }
  return `The existing background${backgrounds.length === 1 ? '' : 's'} has a ${orientation} median tone, so foregrounds are judged against ${backgrounds.length === 1 ? 'it' : 'their least favorable contrast'}.`
}

function inferredRationale(
  orientation: 'light' | 'dark',
  accessible: boolean,
): string {
  return `The ${orientation}-background mapping scored higher${
    accessible ? ' and includes a WCAG AA text pairing' : ''
  }.`
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000
}
