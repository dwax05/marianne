import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { CvdType, Palette } from '../../color/types'
import { collapsedPairs, simulate } from '../../color/cvd'
import { Badge } from '../ui/Badge'

interface Props {
  palette: Palette
}

const TYPES: { key: CvdType; label: string }[] = [
  { key: 'deuter', label: 'Deuteranopia' },
  { key: 'prot', label: 'Protanopia' },
  { key: 'trit', label: 'Tritanopia' },
]

export function CvdPanel({ palette }: Props) {
  const [type, setType] = useState<CvdType>('deuter')

  const sim = useMemo(
    () => palette.map((s) => ({ id: s.id, hex: simulate(s.hex, type) })),
    [palette, type],
  )
  const collapsed = useMemo(
    () => collapsedPairs(palette, type, 15),
    [palette, type],
  )
  const byId = Object.fromEntries(palette.map((s) => [s.id, s.hex]))

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg bg-surface-2 p-0.5 text-sm">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className="relative px-2.5 py-1 text-xs font-medium"
          >
            {type === t.key && (
              <motion.span
                layoutId="cvd-type-pill"
                className="absolute inset-0 rounded-md bg-accent"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <span
              className={`relative z-10 ${type === t.key ? 'text-accent-fg' : 'text-muted'}`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs text-muted">Simulated appearance</div>
        <div className="flex flex-wrap gap-1">
          {sim.map((s) => (
            <span
              key={s.id}
              className="h-8 w-8 rounded"
              style={{ background: s.hex }}
              title={`${byId[s.id]} → ${s.hex}`}
            />
          ))}
        </div>
      </div>

      {collapsed.length === 0 ? (
        <p className="text-sm text-muted">
          No colors become hard to distinguish under {labelFor(type)}.
        </p>
      ) : (
        <ul className="space-y-2">
          {collapsed.map((c) => (
            <li
              key={`${c.aId}-${c.bId}`}
              className="flex items-center gap-2 rounded-lg border border-line/50 bg-surface-2 p-2 text-sm"
            >
              <Chip hex={byId[c.aId]} />
              <Chip hex={byId[c.bId]} />
              <span className="text-muted">
                look alike (ΔE {c.distance.toFixed(1)})
              </span>
              <Badge tone="warn">confusable</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Chip({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block h-6 w-6 rounded border border-white/10"
      style={{ background: hex }}
      title={hex}
    />
  )
}

function labelFor(t: CvdType) {
  return TYPES.find((x) => x.key === t)?.label ?? t
}
