/** Clamp a number to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Clamp a number to [0, 1]. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}
