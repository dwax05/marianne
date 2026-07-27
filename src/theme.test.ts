import { describe, expect, it, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
} from './theme'

describe('theme preferences', () => {
  it('defaults to light mode when no valid preference is stored', () => {
    expect(readStoredTheme({ getItem: () => null })).toBe('light')
    expect(readStoredTheme({ getItem: () => 'system' })).toBe('light')
  })

  it('restores a stored dark-mode preference', () => {
    expect(readStoredTheme({ getItem: () => 'dark' })).toBe('dark')
  })

  it('applies and persists a theme', () => {
    const dataset: DOMStringMap = {}
    const setItem = vi.fn()

    applyTheme('dark', { dataset }, { setItem })

    expect(dataset.theme).toBe('dark')
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark')
  })

  it('keeps the UI usable when storage is unavailable', () => {
    const dataset: DOMStringMap = {}

    expect(() =>
      applyTheme(
        'dark',
        { dataset },
        {
          setItem: () => {
            throw new Error('Storage unavailable')
          },
        },
      ),
    ).not.toThrow()
    expect(dataset.theme).toBe('dark')
  })
})
