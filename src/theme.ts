export const THEME_STORAGE_KEY = 'marianne-theme'

export type Theme = 'light' | 'dark'

export interface ThemeTransitionOrigin {
  x: number
  y: number
}

type ThemeReader = Pick<Storage, 'getItem'>
type ThemeWriter = Pick<Storage, 'setItem'>
type ThemeRoot = Pick<HTMLElement, 'dataset'>

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function documentRoot(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement
}

export function readStoredTheme(
  storage: ThemeReader | null = browserStorage(),
): Theme {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(
  theme: Theme,
  root: ThemeRoot | null = documentRoot(),
  storage: ThemeWriter | null = browserStorage(),
) {
  if (root) root.dataset.theme = theme
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Theme switching should still work when storage is blocked or full.
  }
}

export function themeTransitionRadius(
  { x, y }: ThemeTransitionOrigin,
  viewportWidth: number,
  viewportHeight: number,
) {
  return Math.hypot(
    Math.max(x, viewportWidth - x),
    Math.max(y, viewportHeight - y),
  )
}
