import { toHex, toOklch } from './convert'

export type PaintRgb = [number, number, number]

/** A pleasing weighted paint mixture in OKLCH, gamut-clamped for display. */
export function mixPaint(
  base: string,
  incoming: string,
  incomingWeight = 0.5,
): string {
  const a = toOklch(base)
  const b = toOklch(incoming)
  if (!a || !b) return incoming
  const weight = Math.max(0, Math.min(1, incomingWeight))
  let hueDelta = b.h - a.h
  if (hueDelta > 180) hueDelta -= 360
  if (hueDelta < -180) hueDelta += 360
  return toHex({
    l: a.l + (b.l - a.l) * weight,
    c: a.c + (b.c - a.c) * weight,
    h: (a.h + hueDelta * weight + 360) % 360,
  })
}

/** Convert a displayable paint color to an RGB tuple for canvas pixel work. */
export function toPaintRgb(hex: string): PaintRgb {
  const raw = hex.replace(/^#/, '')
  const value = raw.length === 3
    ? raw.split('').map((part) => part + part).join('')
    : raw
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

/** Mix an existing canvas pixel with incoming paint through the color module. */
export function mixPaintPixel(base: PaintRgb, incoming: string): PaintRgb {
  return toPaintRgb(mixPaint(rgbToHex(...base), incoming, 0.5))
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`
}
