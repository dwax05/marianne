// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Palette } from '../../color/types'
import { PaletteSimplifySuggestion } from './PaletteSimplifySuggestion'

const palette: Palette = [
  { id: 'primary', hex: '#3a7bd5', role: 'primary', locked: false },
  { id: 'white', hex: '#ffffff', role: 'unset', locked: false },
  { id: 'black', hex: '#000000', role: 'unset', locked: false },
  { id: 'red', hex: '#ff0000', role: 'unset', locked: false },
  { id: 'green', hex: '#00ff00', role: 'unset', locked: false },
  { id: 'blue', hex: '#0000ff', role: 'unset', locked: false },
  { id: 'yellow', hex: '#ffff00', role: 'unset', locked: false },
  { id: 'cyan', hex: '#00ffff', role: 'unset', locked: false },
  { id: 'duplicate', hex: '#3a7bd5', role: 'unset', locked: false },
]

describe('PaletteSimplifySuggestion', () => {
  it('reviews and applies a conservative cleanup', () => {
    const onApply = vi.fn()
    render(<PaletteSimplifySuggestion palette={palette} onApply={onApply} />)

    expect(
      screen.getByRole('region', {
        name: 'Palette simplification suggestion',
      }),
    ).toHaveTextContent('9 → 8 colors')

    fireEvent.click(screen.getByText('Review similar colors'))
    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('ΔE 0.0')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Simplify to 8 colors' }))

    expect(onApply).toHaveBeenCalledOnce()
    const next = onApply.mock.calls[0][0] as Palette
    expect(next).toHaveLength(8)
    expect(next.some((swatch) => swatch.id === 'primary')).toBe(true)
    expect(next.some((swatch) => swatch.id === 'duplicate')).toBe(false)
  })

  it('stays hidden when a large palette has no safe redundancy', () => {
    const protectedPalette = palette.map((swatch) => ({
      ...swatch,
      locked: true,
    }))
    const { container } = render(
      <PaletteSimplifySuggestion
        palette={protectedPalette}
        onApply={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('stays dismissed until the palette changes', () => {
    const { rerender } = render(
      <PaletteSimplifySuggestion palette={palette} onApply={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(
      screen.queryByRole('region', {
        name: 'Palette simplification suggestion',
      }),
    ).toBeNull()

    rerender(
      <PaletteSimplifySuggestion
        palette={[
          ...palette,
          { id: 'extra', hex: '#654321', role: 'unset', locked: false },
        ]}
        onApply={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('region', {
        name: 'Palette simplification suggestion',
      }),
    ).toBeInTheDocument()
  })
})
