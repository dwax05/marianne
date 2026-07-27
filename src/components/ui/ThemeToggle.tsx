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
      // Match the 3px keycap of the neighboring primary/surface buttons so the
      // toggle reads as the same raised size (base IconButton is a flatter 2px).
      // active:!shadow-none re-drops the keycap on press so it flattens instead
      // of the shadow riding down with the button.
      className="shrink-0 !shadow-[0_3px_0_rgb(var(--keycap)_/_0.22)] active:!translate-y-[3px] active:!shadow-none"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  )
}
