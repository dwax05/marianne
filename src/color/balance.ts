import type { Oklch, Palette } from './types'
import { toOklch, toHex } from './convert'
import { NEUTRAL_CHROMA_MAX } from './audit'

export interface BalanceStep {
  id: string
  hex: string
  l: number
  c: number
  h: number
  /** Lightness gap to the previous (sorted) swatch; 0 for the first. */
  gapL: number
}

export interface BalanceReport {
  steps: BalanceStep[]
  /** Standard deviation of the lightness gaps — lower is more even. */
  unevenness: number
}

/** Sort swatches by OKLCH lightness and report the spacing between them. */
export function analyzeBalance(palette: Palette): BalanceReport {
  const withColor = palette
    .map((s) => ({ s, o: toOklch(s.hex) }))
    .filter((x): x is { s: Palette[number]; o: Oklch } => x.o !== null)
    .sort((a, b) => a.o.l - b.o.l)

  const steps: BalanceStep[] = withColor.map((x, i) => {
    const prev = withColor[i - 1]
    return {
      id: x.s.id,
      hex: x.s.hex,
      l: x.o.l,
      c: x.o.c,
      h: x.o.h,
      gapL: prev ? x.o.l - prev.o.l : 0,
    }
  })

  // Neutral anchors (near-achromatic light/dark) sit at the tonal extremes by
  // design — they are not part of the chromatic ramp, so judging their spacing
  // as "uneven" would penalize a healthy palette. Measure evenness only across
  // the chromatic swatches, mirroring how harmony ignores neutrals.
  const chromatic = withColor.filter((x) => x.o.c > NEUTRAL_CHROMA_MAX)
  const gaps = chromatic.slice(1).map((x, i) => x.o.l - chromatic[i].o.l)
  const unevenness = gaps.length ? stddev(gaps) : 0
  return { steps, unevenness }
}

/**
 * Respace the palette to uniform lightness steps between the current min and
 * max lightness, preserving each swatch's chroma and hue (gamut-clamped).
 * Returns a new palette in lightness order.
 */
export function evenRamp(palette: Palette): Palette {
  const report = analyzeBalance(palette)
  const steps = report.steps
  if (steps.length < 2) return palette

  const lo = steps[0].l
  const hi = steps[steps.length - 1].l
  const span = hi - lo
  const byId = new Map(palette.map((s) => [s.id, s]))

  return steps.map((step, i) => {
    const orig = byId.get(step.id)!
    // Locked colors keep their exact value; only unlocked ones get respaced.
    if (orig.locked) return orig
    const t = i / (steps.length - 1)
    const l = lo + span * t
    return { ...orig, hex: toHex({ l, c: step.c, h: step.h }) }
  })
}

function stddev(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const variance =
    xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length
  return Math.sqrt(variance)
}
