import { motion } from 'motion/react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/**
 * A row of mutually exclusive pill tabs with a sliding `layoutId` accent pill
 * that animates between the selected options. Each instance needs a unique
 * `layoutId` so separate controls don't animate into one another.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  layoutId,
  size = 'md',
  className = '',
}: {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  layoutId: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1'
  return (
    <div className={`inline-flex rounded-lg bg-surface-2 p-0.5 text-sm ${className}`}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`relative rounded-md font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${pad}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-accent"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <span
              className={`relative z-10 ${active ? 'text-accent-fg' : 'text-muted'}`}
            >
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
