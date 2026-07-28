import { describe, expect, it } from 'vitest'
import {
  PALETTE_ATTENTION_THRESHOLD,
  REDUNDANT_COLOR_DELTA_E,
  suggestPaletteSimplification,
} from './simplify'
import type { Palette, Role } from './types'

const distinct = [
  '#000000',
  '#ffffff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#00ffff',
  '#ff00ff',
  '#808080',
]

function palette(
  colors: string[],
  options: Record<string, { role?: Role; locked?: boolean }> = {},
): Palette {
  return colors.map((hex, index) => ({
    id: `s${index}`,
    hex,
    role: options[`s${index}`]?.role ?? 'unset',
    locked: options[`s${index}`]?.locked ?? false,
  }))
}

describe('palette simplification', () => {
  it('treats eight colors as a soft threshold, even with a duplicate', () => {
    const colors = [
      ...distinct.slice(0, PALETTE_ATTENTION_THRESHOLD - 1),
      '#000000',
    ]

    expect(suggestPaletteSimplification(palette(colors))).toBeNull()
  })

  it('does not suggest cleanup for a large but distinct palette', () => {
    expect(suggestPaletteSimplification(palette(distinct))).toBeNull()
  })

  it('removes redundant unlocked, unassigned colors above the threshold', () => {
    const input = palette([...distinct, '#000000', '#ff0000'])
    const plan = suggestPaletteSimplification(input)

    expect(REDUNDANT_COLOR_DELTA_E).toBe(6)
    expect(plan).not.toBeNull()
    expect(plan!.originalCount).toBe(11)
    expect(plan!.simplifiedCount).toBe(9)
    expect(plan!.groups).toEqual([
      {
        keeperId: 's0',
        redundant: [{ swatchId: 's9', distance: 0 }],
      },
      {
        keeperId: 's2',
        redundant: [{ swatchId: 's10', distance: 0 }],
      },
    ])
    expect(plan!.palette.map((swatch) => swatch.id)).toEqual(
      distinct.map((_, index) => `s${index}`),
    )
  })

  it('keeps locked and role-assigned colors even when they occur later', () => {
    const input = palette(
      ['#3a7bd5', ...distinct, '#3a7bd5', '#123456'],
      {
        s10: { role: 'primary' },
        s11: { locked: true },
      },
    )
    const plan = suggestPaletteSimplification(input)

    expect(plan?.groups).toEqual([
      {
        keeperId: 's10',
        redundant: [{ swatchId: 's0', distance: 0 }],
      },
    ])
    expect(plan?.palette.find((swatch) => swatch.id === 's10')).toMatchObject({
      role: 'primary',
    })
    expect(plan?.palette.find((swatch) => swatch.id === 's11')).toMatchObject({
      locked: true,
    })
  })

  it('does not offer an unsafe cleanup when every duplicate is protected', () => {
    const input = palette(distinct, {
      s0: { role: 'text' },
      s8: { locked: true },
    })
    input[8] = { ...input[8], hex: input[0].hex }

    expect(suggestPaletteSimplification(input)).toBeNull()
  })

  it('does not remove the only color providing neutral coverage', () => {
    const input = palette([
      '#d5d5d5',
      '#000000',
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#ffff00',
      '#00ffff',
      '#ff00ff',
      '#808080',
      '#eeeeee',
    ])

    // #d5d5d5 is within 6 ΔE of #eeeeee, but only #eeeeee crosses the
    // light-neutral coverage boundary.
    expect(suggestPaletteSimplification(input)).toBeNull()
  })
})
