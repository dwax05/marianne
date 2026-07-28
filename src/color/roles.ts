import { AA_NORMAL, contrast } from './contrast'
import { clamp01 } from '../lib/num'
import type { Palette, Role } from './types'
import {
  ACCESSIBILITY_QUALITY_BONUS,
  LOW_CONFIDENCE_QUALITY_PENALTY,
  ROLE_ORDER,
  SCORE_EPSILON,
  backgroundScore,
  chooseBest,
  compareCandidates,
  confidenceFor,
  invalidFallback,
  measurePalette,
  rankedAlternatives,
  roundScore,
  scoreRole,
  textScore,
} from './roleScoring'
import type { MeasuredSwatch, ScoringContext } from './roleScoring'

// The confidence thresholds live with the scoring engine but remain part of the
// public role API, so re-export them here for existing importers.
export {
  HIGH_CONFIDENCE_MARGIN_MIN,
  HIGH_CONFIDENCE_SCORE_MIN,
  MEDIUM_CONFIDENCE_MARGIN_MIN,
  MEDIUM_CONFIDENCE_SCORE_MIN,
} from './roleScoring'

export type RoleConfidence = 'high' | 'medium' | 'low'
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

const ASSIGNABLE_ROLE_SET = new Set<AssignableRole>(ROLE_ORDER)

const UNIQUE_ROLE_BITS = new Map(
  UNIQUE_ASSISTANT_ROLES.map((role, index) => [role, 1 << index]),
)

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

function assignmentMask(
  occupiedExplicit: Set<AssignableRole>,
  assigned: Map<string, AssignableRole>,
): number {
  let mask = 0
  for (const role of occupiedExplicit) mask |= UNIQUE_ROLE_BITS.get(role) ?? 0
  for (const role of assigned.values()) mask |= UNIQUE_ROLE_BITS.get(role) ?? 0
  return mask
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
