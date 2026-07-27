import {
  filterDeficiencyProt,
  filterDeficiencyDeuter,
  filterDeficiencyTrit,
  formatHex,
  differenceCiede2000,
  parse,
} from 'culori'
import type { CollapsedPair, CvdType, Hex, Palette } from './types'

const filters = {
  prot: filterDeficiencyProt,
  deuter: filterDeficiencyDeuter,
  trit: filterDeficiencyTrit,
} as const

const deltaE = differenceCiede2000()

/**
 * Simulate how `hex` appears to someone with the given color vision deficiency.
 * severity 0 = normal vision, 1 = full deficiency.
 */
export function simulate(hex: Hex, type: CvdType, severity = 1): Hex {
  const parsed = parse(hex)
  if (!parsed) return hex
  const filtered = filters[type](severity)(parsed)
  return formatHex(filtered) ?? hex
}

/**
 * Pairs that become hard to tell apart under a CVD type: their simulated
 * colors fall within `threshold` CIEDE2000 units of each other. Default 10
 * (~"colors are close"); lower = stricter. Sorted closest-first.
 */
export function collapsedPairs(
  palette: Palette,
  type: CvdType,
  threshold = 10,
  severity = 1,
): CollapsedPair[] {
  const sim = palette.map((s) => simulate(s.hex, type, severity))
  const out: CollapsedPair[] = []
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const distance = deltaE(sim[i], sim[j])
      if (distance <= threshold) {
        out.push({ aId: palette[i].id, bId: palette[j].id, distance })
      }
    }
  }
  out.sort((a, b) => a.distance - b.distance)
  return out
}
