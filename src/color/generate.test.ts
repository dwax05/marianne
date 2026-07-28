import { describe, expect, it } from 'vitest'
import { paletteHealth } from './health'
import {
  AUTOMATIC_PALETTE_MIN_HEALTH,
  generateAutomaticPalette,
} from './generate'

describe('automatic palette generation', () => {
  it.each([false, true])(
    'returns palettes at or above the health floor (roles: %s)',
    (withRoles) => {
      for (let seed = 1; seed <= 100; seed++) {
        const generated = generateAutomaticPalette({
          withRoles,
          random: seededRandom(seed),
        })

        expect(generated.health).toBe(paletteHealth(generated.palette).score)
        expect(generated.health).toBeGreaterThanOrEqual(
          AUTOMATIC_PALETTE_MIN_HEALTH,
        )
        expect(
          paletteHealth(generated.palette).checks.every(
            (check) => check.status !== 'bad',
          ),
        ).toBe(true)
        expect(generated.palette).toHaveLength(5)
        expect(
          generated.palette.every((swatch) =>
            withRoles ? swatch.role !== 'unset' : swatch.role === 'unset',
          ),
        ).toBe(true)
        if (withRoles) {
          expect(
            generated.palette.some((swatch) => swatch.role === 'background'),
          ).toBe(true)
          expect(
            generated.palette.some((swatch) => swatch.role === 'text'),
          ).toBe(true)
        }
      }
    },
  )
})

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
