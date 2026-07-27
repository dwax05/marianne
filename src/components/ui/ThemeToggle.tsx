import type { Theme, ThemeTransitionOrigin } from '../../theme'
import { IconButton } from './Button'
import { MoonIcon, SunIcon } from './icons'

export interface ThemeToggleProps {
  theme: Theme
  onThemeToggle: (origin: ThemeTransitionOrigin) => void
}

export function ThemeToggle({ theme, onThemeToggle }: ThemeToggleProps) {
  const dark = theme === 'dark'
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <IconButton
      type="button"
      onClick={(event) => {
        const bounds =
          event.currentTarget.querySelector('svg')?.getBoundingClientRect() ??
          event.currentTarget.getBoundingClientRect()
        onThemeToggle({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        })
      }}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      className="shrink-0"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  )
}
