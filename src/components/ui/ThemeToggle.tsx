import type { Theme } from '../../theme'
import { IconButton } from './Button'
import { MoonIcon, SunIcon } from './icons'

export interface ThemeToggleProps {
  theme: Theme
  onThemeToggle: () => void
}

export function ThemeToggle({ theme, onThemeToggle }: ThemeToggleProps) {
  const dark = theme === 'dark'
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <IconButton
      type="button"
      onClick={onThemeToggle}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      className="shrink-0"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  )
}
