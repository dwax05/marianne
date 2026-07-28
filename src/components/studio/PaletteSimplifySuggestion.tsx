import { useEffect, useMemo, useState } from 'react'
import type { Palette } from '../../color/types'
import { ROLE_LABELS } from '../../color/types'
import { suggestPaletteSimplification } from '../../color/simplify'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ColorChip } from '../ui/ColorChip'
import { CloseIcon, SparkleIcon } from '../ui/icons'

interface Props {
  palette: Palette
  onApply: (palette: Palette) => void
}

export function PaletteSimplifySuggestion({ palette, onApply }: Props) {
  const plan = useMemo(() => suggestPaletteSimplification(palette), [palette])
  const paletteSignature = useMemo(
    () =>
      palette
        .map(
          (swatch) =>
            `${swatch.id}:${swatch.hex}:${swatch.role}:${Number(swatch.locked)}`,
        )
        .join('|'),
    [palette],
  )
  const [dismissedSignature, setDismissedSignature] = useState('')

  useEffect(() => {
    if (dismissedSignature && dismissedSignature !== paletteSignature) {
      setDismissedSignature('')
    }
  }, [dismissedSignature, paletteSignature])

  if (!plan || dismissedSignature === paletteSignature) return null

  const byId = new Map(palette.map((swatch) => [swatch.id, swatch]))
  const removedCount = plan.originalCount - plan.simplifiedCount

  return (
    <section
      aria-label="Palette simplification suggestion"
      className="rounded-xl border border-accent/30 bg-accent/5 p-3"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-accent">
          <SparkleIcon width={16} height={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-fg">Simplify palette</h3>
            <Badge tone="neutral">
              {plan.originalCount} → {plan.simplifiedCount} colors
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            This palette is getting large, and {removedCount}{' '}
            {removedCount === 1 ? 'color is' : 'colors are'} very similar to a
            retained color.
          </p>
        </div>
      </div>

      <details className="mt-2 rounded-lg border border-line/40 bg-surface/60 px-2.5 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted">
          Review similar colors
        </summary>
        <div className="mt-2 space-y-2">
          {plan.groups.map((group) => {
            const keeper = byId.get(group.keeperId)
            if (!keeper) return null
            return (
              <div
                key={group.keeperId}
                className="rounded-md border border-line/40 bg-surface-2/60 p-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-1.5 text-fg">
                  <span className="w-12 shrink-0 font-medium text-muted">Keep</span>
                  <ColorChip hex={keeper.hex} className="h-5 w-5 shrink-0" />
                  <span className="truncate font-mono uppercase">{keeper.hex}</span>
                  {keeper.role !== 'unset' && (
                    <span className="ml-auto shrink-0 text-[11px] text-muted">
                      {ROLE_LABELS[keeper.role]}
                    </span>
                  )}
                </div>
                {group.redundant.map((redundant) => {
                  const swatch = byId.get(redundant.swatchId)
                  if (!swatch) return null
                  return (
                    <div
                      key={redundant.swatchId}
                      className="mt-1.5 flex min-w-0 items-center gap-1.5 text-muted"
                    >
                      <span className="w-12 shrink-0 font-medium">Remove</span>
                      <ColorChip hex={swatch.hex} className="h-5 w-5 shrink-0" />
                      <span className="truncate font-mono uppercase">{swatch.hex}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px]">
                        ΔE {redundant.distance.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </details>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Locked colors, assigned roles, and neutral coverage stay untouched. This
        is one undoable change.
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => setDismissedSignature(paletteSignature)}
        >
          <CloseIcon width={14} height={14} /> Dismiss
        </Button>
        <Button
          variant="primary"
          className="min-w-0 flex-1 text-xs"
          onClick={() => onApply(plan.palette)}
        >
          Simplify to {plan.simplifiedCount} colors
        </Button>
      </div>
    </section>
  )
}
