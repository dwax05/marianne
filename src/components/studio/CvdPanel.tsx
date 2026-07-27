import { useMemo, useState } from 'react'
import type { CvdType, Palette } from '../../color/types'
import { collapsedPairs, simulate } from '../../color/cvd'
import { Badge } from '../ui/Badge'
import { ColorChip } from '../ui/ColorChip'
import { SegmentedControl } from '../ui/SegmentedControl'

interface Props {
  palette: Palette
}

const TYPES: { value: CvdType; label: string }[] = [
  { value: 'deuter', label: 'Deuteranopia' },
  { value: 'prot', label: 'Protanopia' },
  { value: 'trit', label: 'Tritanopia' },
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
      <SegmentedControl
        value={type}
        onChange={setType}
        layoutId="cvd-type-pill"
        options={TYPES}
        size="sm"
      />

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
              <ColorChip hex={byId[c.aId]} className="h-6 w-6" />
              <ColorChip hex={byId[c.bId]} className="h-6 w-6" />
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

function labelFor(t: CvdType) {
  return TYPES.find((x) => x.value === t)?.label ?? t
}
