import { makeSwatch } from './encode'
import {
  randomHarmonyPalette,
  type RandomHarmonyScheme,
} from './harmony'
import { paletteHealth } from './health'
import { applyRoleAssignments, suggestRoles } from './roles'
import type { Hex, Palette } from './types'

export const AUTOMATIC_PALETTE_MIN_HEALTH = 76
const MAX_RANDOM_ATTEMPTS = 24

export interface AutomaticPaletteOptions {
  withRoles: boolean
  random?: () => number
}

export interface AutomaticPalette {
  palette: Palette
  scheme: RandomHarmonyScheme
  baseHex: Hex
  health: number
}

interface AutomaticPaletteCandidate extends AutomaticPalette {
  hasBadCheck: boolean
}

/**
 * Generate a five-color palette that clears Marianne's health floor. Random
 * candidates are bounded; a known-safe deterministic candidate prevents a
 * pathological random source from hanging generation or returning weak work.
 */
export function generateAutomaticPalette({
  withRoles,
  random = Math.random,
}: AutomaticPaletteOptions): AutomaticPalette {
  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
    const candidate = createCandidate(withRoles, random)
    if (meetsHealthFloor(candidate)) return acceptedPalette(candidate)
  }

  const fallback = createCandidate(withRoles, () => 0)
  if (!meetsHealthFloor(fallback)) {
    throw new Error(
      'The automatic palette fallback no longer meets its health floor.',
    )
  }
  return acceptedPalette(fallback)
}

function createCandidate(
  withRoles: boolean,
  random: () => number,
): AutomaticPaletteCandidate {
  const generated = randomHarmonyPalette(random)
  const unassigned = generated.colors
    .map((hex) => makeSwatch(hex))
    .filter((swatch): swatch is Palette[number] => swatch !== null)
  const palette = withRoles ? assignSuggestedRoles(unassigned) : unassigned

  const health = paletteHealth(palette)
  return {
    palette,
    scheme: generated.scheme,
    baseHex: generated.baseHex,
    health: health.score,
    hasBadCheck: health.checks.some((check) => check.status === 'bad'),
  }
}

function assignSuggestedRoles(palette: Palette): Palette {
  const assignments = suggestRoles(palette).suggestions.map((suggestion) => ({
    swatchId: suggestion.swatchId,
    role: suggestion.recommended.role,
  }))
  const assigned = applyRoleAssignments(palette, assignments)
  if (
    !assigned ||
    assigned.some((swatch) => swatch.role === 'unset') ||
    !assigned.some((swatch) => swatch.role === 'background') ||
    !assigned.some((swatch) => swatch.role === 'text')
  ) {
    throw new Error('Automatic role assignment did not produce a complete palette.')
  }
  return assigned
}

function meetsHealthFloor(candidate: AutomaticPaletteCandidate): boolean {
  return (
    candidate.health >= AUTOMATIC_PALETTE_MIN_HEALTH && !candidate.hasBadCheck
  )
}

function acceptedPalette(
  candidate: AutomaticPaletteCandidate,
): AutomaticPalette {
  const { hasBadCheck: _hasBadCheck, ...accepted } = candidate
  return accepted
}
