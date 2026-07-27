import { converter, formatHex, clampChroma, parse } from 'culori'
import type { Hex, Oklch } from './types'

const toOklchColor = converter('oklch')

/** Parse a hex/CSS string to OKLCH. Returns null if unparseable. */
export function toOklch(input: Hex): Oklch | null {
  const parsed = parse(input)
  if (!parsed) return null
  const o = toOklchColor(parsed)
  if (!o) return null
  return { l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 }
}

/** OKLCH -> hex, gamut-clamped so the result is always displayable. */
export function toHex(o: Oklch): Hex {
  const clamped = clampChroma({ mode: 'oklch', l: o.l, c: o.c, h: o.h }, 'oklch')
  return formatHex(clamped) ?? '#000000'
}

/** Clamp an OKLCH color into the sRGB gamut, preserving hue. */
export function clampToGamut(o: Oklch): Oklch {
  const clamped = clampChroma({ mode: 'oklch', l: o.l, c: o.c, h: o.h }, 'oklch')
  return { l: clamped.l ?? 0, c: clamped.c ?? 0, h: clamped.h ?? o.h }
}

/** True if a string parses to a valid color. */
export function isValidColor(input: string): boolean {
  return normalizeHex(input) !== null
}

/** Normalize CSS colors and bare 3/4/6/8-digit hex values to #rrggbb. */
export function normalizeHex(input: string): Hex | null {
  const trimmed = input.trim()
  const candidate = /^[0-9a-f]{3,4}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(
    trimmed,
  )
    ? `#${trimmed}`
    : trimmed
  const parsed = parse(candidate)
  if (!parsed) return null
  return formatHex(parsed) ?? null
}
