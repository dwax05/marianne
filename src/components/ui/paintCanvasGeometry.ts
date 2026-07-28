export interface PaintPoint {
  x: number
  y: number
}

/** Translate viewport pointer coordinates into persistent document space. */
export function pointFromViewport(
  point: PaintPoint,
  scroll: PaintPoint,
): PaintPoint {
  return {
    x: point.x + scroll.x,
    y: point.y + scroll.y,
  }
}

/** Translate a stored document point into the current viewport buffer. */
export function pointToViewport(
  point: PaintPoint,
  scroll: PaintPoint,
): PaintPoint {
  return {
    x: point.x - scroll.x,
    y: point.y - scroll.y,
  }
}
