import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Physical-press buttons: a hard bottom shadow that reads as a raised keycap,
 * translating down on `active` so the shadow disappears. Hover brightens rather
 * than recoloring. 100ms transitions — snappy, not floaty.
 */

type Variant = 'primary' | 'surface' | 'ghost' | 'card' | 'paint'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-[0_3px_0_rgba(91,62,39,0.28)] hover:brightness-105 active:translate-y-[3px] active:shadow-none disabled:hover:brightness-100',
  surface:
    'bg-surface-2 text-fg border border-line/60 shadow-[0_3px_0_rgba(91,62,39,0.22)] hover:brightness-105 active:translate-y-[3px] active:shadow-none',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  card:
    '!block border border-line/40 bg-surface text-fg shadow-lg shadow-[#7d684f]/15 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#7d684f]/25',
  paint: 'bg-transparent !p-0',
}

export function Button({
  variant = 'surface',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children?: ReactNode
}) {
  return (
    <button
      type={type}
      className={`${base} px-3 py-1.5 text-sm ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  className = '',
  active,
  danger,
  type = 'button',
  title,
  'aria-label': ariaLabel,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel ?? title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line/50 bg-surface-2 shadow-[0_2px_0_rgba(91,62,39,0.2)] transition-all duration-100 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-[2px] active:shadow-none ${
        active ? 'text-accent' : danger ? 'text-muted hover:text-bad' : 'text-muted hover:text-fg'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
