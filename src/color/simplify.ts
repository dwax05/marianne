import { differenceCiede2000 } from 'culori'
import type { Palette, Swatch } from './types'
import { analyzeCoverage } from './audit'

/** Palette size that earns a quiet complexity review, never a health penalty. */
export const PALETTE_ATTENTION_THRESHOLD = 8

/** Existing project boundary below which two colors read as effectively alike. */
export const REDUNDANT_COLOR_DELTA_E = 6

export interface RedundantColor {
  swatchId: string
  distance: number
}

export interface SimplificationGroup {
  keeperId: string
  redundant: RedundantColor[]
}

export interface SimplificationPlan {
  originalCount: number
  simplifiedCount: number
  groups: SimplificationGroup[]
  palette: Palette
}

interface MeasuredSwatch {
  swatch: Swatch
  index: number
}

const perceptualDifference = differenceCiede2000()
const DISTANCE_EPSILON = 1e-9

/**
 * Suggest a conservative reduction only after the palette passes the soft size
 * threshold. Locked and role-assigned colors are always retained. An unprotected
 * color is retained when it differs from every protected or previously retained
 * swatch; otherwise it is proposed for removal beside its closest keeper.
 */
export function suggestPaletteSimplification(
  palette: Palette,
): SimplificationPlan | null {
  if (palette.length <= PALETTE_ATTENTION_THRESHOLD) return null

  const measured = palette.map((swatch, index) => ({ swatch, index }))
  const retained: MeasuredSwatch[] = measured.filter(isProtected)
  const groupsByKeeper = new Map<string, SimplificationGroup>()
  const removedIds = new Set<string>()
  const initialCoverage = analyzeCoverage(palette)

  for (const entry of measured) {
    if (isProtected(entry)) continue

    const match = closestRetained(entry, retained)
    if (
      !match ||
      !preservesNeutralCoverage(
        palette,
        removedIds,
        entry.swatch.id,
        initialCoverage,
      )
    ) {
      retained.push(entry)
      continue
    }

    removedIds.add(entry.swatch.id)
    const group = groupsByKeeper.get(match.keeper.swatch.id) ?? {
      keeperId: match.keeper.swatch.id,
      redundant: [],
    }
    group.redundant.push({
      swatchId: entry.swatch.id,
      distance: match.distance,
    })
    groupsByKeeper.set(group.keeperId, group)
  }

  if (removedIds.size === 0) return null

  const groups = [...groupsByKeeper.values()].sort(
    (a, b) => indexOf(palette, a.keeperId) - indexOf(palette, b.keeperId),
  )
  const simplified = palette.filter((swatch) => !removedIds.has(swatch.id))

  return {
    originalCount: palette.length,
    simplifiedCount: simplified.length,
    groups,
    palette: simplified,
  }
}

function isProtected({ swatch }: MeasuredSwatch): boolean {
  return swatch.locked || swatch.role !== 'unset'
}

function closestRetained(
  entry: MeasuredSwatch,
  retained: MeasuredSwatch[],
): { keeper: MeasuredSwatch; distance: number } | null {
  let best: { keeper: MeasuredSwatch; distance: number } | null = null

  for (const keeper of retained) {
    const distance = perceptualDifference(entry.swatch.hex, keeper.swatch.hex)
    if (!Number.isFinite(distance) || distance >= REDUNDANT_COLOR_DELTA_E) {
      continue
    }
    if (
      !best ||
      distance < best.distance - DISTANCE_EPSILON ||
      (Math.abs(distance - best.distance) <= DISTANCE_EPSILON &&
        keeper.index < best.keeper.index)
    ) {
      best = { keeper, distance }
    }
  }

  return best
}

function indexOf(palette: Palette, id: string): number {
  return palette.findIndex((swatch) => swatch.id === id)
}

function preservesNeutralCoverage(
  palette: Palette,
  removedIds: Set<string>,
  candidateId: string,
  initial: ReturnType<typeof analyzeCoverage>,
): boolean {
  const after = analyzeCoverage(
    palette.filter(
      (swatch) => !removedIds.has(swatch.id) && swatch.id !== candidateId,
    ),
  )
  return (
    (!initial.hasLightNeutral || after.hasLightNeutral) &&
    (!initial.hasDarkNeutral || after.hasDarkNeutral)
  )
}
