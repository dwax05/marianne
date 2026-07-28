// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Studio } from './Studio'

const scrollIntoView = vi.fn()

describe('Studio empty-palette navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '#/app?p=empty')
    scrollIntoView.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
  })

  it('focuses and highlights the palette generator on every request', async () => {
    render(<Studio theme="light" onThemeToggle={() => undefined} />)

    const openGenerator = screen.getByRole('button', {
      name: 'Generate a palette',
    })
    fireEvent.click(openGenerator)

    const heading = await screen.findByRole('heading', {
      name: 'Generate a palette',
    })
    const section = heading.closest('section')
    expect(section).not.toBeNull()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce())
    expect(section).toHaveFocus()
    expect(section).toHaveClass('ring-2')

    fireEvent.click(openGenerator)

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2))
    expect(section).toHaveFocus()
    expect(section).toHaveClass('ring-2')
  })
})
