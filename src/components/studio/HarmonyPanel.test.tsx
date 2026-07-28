// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paletteHealth } from '../../color/health'
import type { Palette } from '../../color/types'
import { HarmonyPanel } from './HarmonyPanel'

describe('HarmonyPanel random palette', () => {
  afterEach(() => vi.restoreAllMocks())

  it('replaces the palette and leaves the random base ready to refine', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const onReplace = vi.fn()
    render(
      <HarmonyPanel
        palette={[]}
        onReplace={onReplace}
        onAppend={vi.fn()}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Generate random palette' }),
    )

    expect(onReplace).toHaveBeenCalledOnce()
    const generated = onReplace.mock.calls[0][0] as Palette
    expect(generated).toHaveLength(5)
    expect(generated.every((swatch) => swatch.role === 'unset')).toBe(true)
    expect(generated.every((swatch) => swatch.locked === false)).toBe(true)
    expect(paletteHealth(generated).score).toBeGreaterThanOrEqual(70)
    expect(screen.getByRole('status')).toHaveTextContent(
      /Analogous palette generated from #[0-9a-f]{6} · health \d+\/100/,
    )
    expect(
      screen.getByRole<HTMLInputElement>('textbox', {
        name: 'base color hex value',
      }).value,
    ).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('can generate a palette with suggested roles already applied', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const onReplace = vi.fn()
    render(
      <HarmonyPanel
        palette={[]}
        onReplace={onReplace}
        onAppend={vi.fn()}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Generate palette with roles' }),
    )

    expect(onReplace).toHaveBeenCalledOnce()
    const generated = onReplace.mock.calls[0][0] as Palette
    expect(generated).toHaveLength(5)
    expect(generated.every((swatch) => swatch.role !== 'unset')).toBe(true)
    expect(generated.some((swatch) => swatch.role === 'background')).toBe(true)
    expect(generated.some((swatch) => swatch.role === 'text')).toBe(true)
    const health = paletteHealth(generated)
    expect(health.score).toBeGreaterThan(70)
    expect(health.checks.every((check) => check.status !== 'bad')).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent(
      /Analogous palette generated with roles from #[0-9a-f]{6} · health \d+\/100/,
    )
  })
})
