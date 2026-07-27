import { describe, expect, it } from 'vitest'
import { createBoardLayout } from './paintBoard'

const paints = [
  { id: 'red', color: '#e5484d' },
  { id: 'yellow', color: '#f5d90a' },
  { id: 'blue', color: '#3a7bd5' },
]

describe('artist palette board', () => {
  it('places stable paint wells away from the thumb hole', () => {
    const first = createBoardLayout(600, 420, paints)
    const second = createBoardLayout(600, 420, paints)

    expect(first).toEqual(second)
    expect(first.paints.map((paint) => paint.id)).toEqual([
      'red',
      'yellow',
      'blue',
    ])
    expect(
      first.paints.every(
        (paint) =>
          Math.hypot(paint.x - first.hole.x, paint.y - first.hole.y)
          > paint.radius + Math.max(first.hole.rx, first.hole.ry),
      ),
    ).toBe(true)
  })

})
