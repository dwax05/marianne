export interface PalettePaint {
  id: string
  color: string
}

export interface Point {
  x: number
  y: number
}

export interface PaintWell extends PalettePaint, Point {
  radius: number
  angle: number
}

export interface BoardLayout {
  width: number
  height: number
  cx: number
  cy: number
  rx: number
  ry: number
  hole: Point & { rx: number; ry: number }
  paints: PaintWell[]
}

function hash(input: string): number {
  let value = 2166136261
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0) / 4294967295
}

export function createBoardLayout(
  width: number,
  height: number,
  paints: readonly PalettePaint[],
): BoardLayout {
  const cx = width * 0.5
  const cy = height * 0.51
  const rx = width * 0.45
  const ry = height * 0.41
  const count = Math.max(1, paints.length)
  const radius = Math.max(18, Math.min(38, Math.min(width, height) * (paints.length > 12 ? 0.052 : 0.07)))
  // Keep paint on the left/top arc and reserve the lower-right quadrant for
  // the thumb hole. The final well ends around 320°, safely above the hole.
  const start = Math.PI * 0.72
  const span = Math.PI * 1.06
  const visiblePaints = paints.length > 24
    ? Array.from({ length: 24 }, (_, index) => paints[Math.round((index / 23) * (paints.length - 1))])
    : paints

  const wells = visiblePaints.map((paint, index): PaintWell => {
    const t = count === 1 ? 0.5 : index / Math.max(1, visiblePaints.length - 1)
    const angle = start + span * t
    const jitter = (hash(paint.id) - 0.5) * 0.035
    return {
      ...paint,
      x: cx + Math.cos(angle) * rx * (0.72 + jitter),
      y: cy + Math.sin(angle) * ry * (0.7 + jitter),
      radius: radius * (0.86 + hash(`${paint.id}:radius`) * 0.24),
      angle,
    }
  })

  return {
    width,
    height,
    cx,
    cy,
    rx,
    ry,
    hole: {
      x: cx + rx * 0.62,
      y: cy + ry * 0.38,
      rx: Math.min(rx, ry) * 0.13,
      ry: Math.min(rx, ry) * 0.16,
    },
    paints: wells,
  }
}
