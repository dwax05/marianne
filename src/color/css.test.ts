import { describe, expect, it } from 'vitest'
import { paletteToCss } from './css'
import type { Palette } from './types'

describe('palette CSS export', () => {
  it('uses semantic roles and stable suffixes for every swatch', () => {
    const palette: Palette = [
      { id: 'a', hex: '#ffffff', role: 'background', locked: false },
      { id: 'b', hex: '#3a7bd5', role: 'primary', locked: false },
      { id: 'c', hex: '#e5484d', role: 'accent', locked: false },
      { id: 'd', hex: '#f5d90a', role: 'accent', locked: true },
      { id: 'e', hex: '#8a8f98', role: 'unset', locked: false },
    ]

    expect(paletteToCss(palette)).toBe(`:root {
  --color-background: #ffffff;
  --color-primary: #3a7bd5;
  --color-accent: #e5484d;
  --color-accent-2: #f5d90a;
  --color-5: #8a8f98;
}`)
  })
})
