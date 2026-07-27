// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImagePalettePanel } from './ImagePalettePanel'

vi.mock('../../color/extract', () => ({
  extractPalette: (
    _imageData: Uint8ClampedArray,
    { count }: { count: number },
  ) => [
    '#111111',
    '#222222',
    '#333333',
    '#444444',
    '#555555',
    '#666666',
    '#777777',
    '#888888',
  ].slice(0, count),
}))

class MockImage {
  width = 100
  height = 80
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

describe('ImagePalettePanel palette result picker', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:palette-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      }) as never,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('previews every palette size and applies the selected result', async () => {
    const onReplace = vi.fn()
    const onAppend = vi.fn()
    render(<ImagePalettePanel onReplace={onReplace} onAppend={onAppend} />)

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, {
      target: {
        files: [new File(['image'], 'source.png', { type: 'image/png' })],
      },
    })

    const radios = await screen.findAllByRole('radio')
    expect(radios).toHaveLength(5)
    expect(screen.getByRole('radio', { name: '6 colors' })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: '8 colors' }))
    expect(screen.getByRole('radio', { name: '8 colors' })).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Use' }))
    expect(onReplace).toHaveBeenCalledOnce()
    expect(onReplace.mock.calls[0][0]).toHaveLength(8)

    fireEvent.click(screen.getByRole('radio', { name: '4 colors' }))
    fireEvent.click(screen.getByRole('button', { name: 'Append' }))
    expect(onAppend).toHaveBeenCalledOnce()
    expect(onAppend.mock.calls[0][0]).toHaveLength(4)
  })
})
