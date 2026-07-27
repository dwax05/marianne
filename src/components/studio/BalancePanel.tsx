import { useMemo } from 'react'
import type { Palette } from '../../color/types'
import { analyzeBalance, evenRamp } from '../../color/balance'
import { Button } from '../ui/Button'

interface Props {
  palette: Palette
  onApply: (p: Palette) => void
}

export function BalancePanel({ palette, onApply }: Props) {
  const report = useMemo(() => analyzeBalance(palette), [palette])
  const preview = useMemo(() => evenRamp(palette), [palette])

  if (palette.length < 3)
    return (
      <p className="text-sm text-muted">
        Add three or more colors to analyze perceptual balance.
      </p>
    )

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        Lightness spacing:{' '}
        <span className="font-mono text-fg">
          {report.unevenness < 0.02
            ? 'even'
            : report.unevenness < 0.05
              ? 'slightly uneven'
              : 'uneven'}
        </span>{' '}
        (σ {report.unevenness.toFixed(3)})
      </p>

      <Ramp
        label="Current (sorted by lightness)"
        hexes={report.steps.map((s) => s.hex)}
      />
      <Ramp label="Even OKLCH ramp" hexes={preview.map((s) => s.hex)} />

      <Button variant="primary" onClick={() => onApply(preview)}>
        Apply even ramp
      </Button>
    </div>
  )
}

function Ramp({ label, hexes }: { label: string; hexes: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex overflow-hidden rounded-lg">
        {hexes.map((hex, i) => (
          <span
            key={i}
            className="h-10 flex-1"
            style={{ background: hex }}
            title={hex}
          />
        ))}
      </div>
    </div>
  )
}
