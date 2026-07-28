import { describe, expect, it } from 'vitest'
import {
  pointFromViewport,
  pointToViewport,
} from './paintCanvasGeometry'

describe('paint canvas page coordinates', () => {
  it('keeps a painted point attached to the document as the viewport scrolls', () => {
    const stored = pointFromViewport(
      { x: 120, y: 80 },
      { x: 0, y: 600 },
    )

    expect(stored).toEqual({ x: 120, y: 680 })
    expect(pointToViewport(stored, { x: 0, y: 640 })).toEqual({
      x: 120,
      y: 40,
    })
  })
})
