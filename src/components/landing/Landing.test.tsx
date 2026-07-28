// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Landing } from './Landing'

describe('Landing interactions', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses a mouse wheel to move the hovered sample palettes sideways', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<Landing theme="light" onThemeToggle={() => undefined} />)
    const strip = screen.getByRole('region', { name: 'Sample palettes' })
    Object.defineProperties(strip, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 1200 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    })

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    })
    strip.dispatchEvent(wheel)

    expect(strip.scrollLeft).toBe(120)
    expect(wheel.defaultPrevented).toBe(true)

    strip.scrollLeft = 900
    const atEnd = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    })
    strip.dispatchEvent(atEnd)
    expect(strip.scrollLeft).toBe(900)
    expect(atEnd.defaultPrevented).toBe(false)
  })

  it('keeps painted marks attached to the landing page while it scrolls', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { container } = render(
      <Landing theme="light" onThemeToggle={() => undefined} />,
    )

    const paintCanvas = container.querySelector('.paint-page-canvas')
    expect(paintCanvas).toHaveClass('fixed')
    expect(paintCanvas).not.toHaveClass('absolute')
  })

  it('keeps touch and trackpad scrolling continuous between presets', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<Landing theme="light" onThemeToggle={() => undefined} />)

    const strip = screen.getByRole('region', { name: 'Sample palettes' })
    const firstPreset = screen.getByRole('button', {
      name: /Rainbow of Dreams/,
    })
    expect(strip).not.toHaveClass('snap-x')
    expect(firstPreset).not.toHaveClass('snap-start')
  })
})
