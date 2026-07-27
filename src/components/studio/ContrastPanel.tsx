import { useMemo } from 'react'
import type { Palette } from '../../color/types'
import { ROLE_LABELS } from '../../color/types'
import { AA_NORMAL, rolePairs, suggestContrastFix } from '../../color/contrast'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ColorChip } from '../ui/ColorChip'
import { ArrowRightIcon, LockIcon } from '../ui/icons'

interface Props {
  palette: Palette
  onUpdate: (id: string, hex: string) => void
}

export function ContrastPanel({ palette, onUpdate }: Props) {
  const { pairs, hasBackground } = useMemo(() => rolePairs(palette), [palette])

  if (!hasBackground) {
    return (
      <Hint>
        Mark at least one color as <b className="text-fg">Background</b> and one
        as a foreground role such as <b className="text-fg">Text</b>,{' '}
        <b className="text-fg">Hero</b>, or <b className="text-fg">Accent</b>{' '}
        (using the dropdown on each card). Then marianne checks whether it is
        readable on your background.
      </Hint>
    )
  }
  if (pairs.length === 0) {
    return (
      <Hint>
        You have a background but nothing sitting on it. Give a color the{' '}
        <b className="text-fg">Text</b>, <b className="text-fg">Hero</b>,{' '}
        <b className="text-fg">Primary</b>, or an accent role to check
        readability.
      </Hint>
    )
  }

  const failing = pairs.filter(
    (p) => p.level === 'fail' || p.level === 'AA-large',
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {failing.length === 0
          ? 'Every foreground color is readable on your background(s).'
          : `${failing.length} of ${pairs.length} combinations are hard to read.`}
      </p>

      <ul className="space-y-2">
        {pairs.map((p) => {
          const fix =
            p.level === 'fail' || p.level === 'AA-large'
              ? suggestContrastFix(p.fg.hex, p.bg.hex, AA_NORMAL)
              : null
          const canFix = fix && fix.deltaL !== 0 && !p.fg.locked
          return (
            <li
              key={`${p.fg.id}-${p.bg.id}`}
              className="rounded-lg border border-line/50 bg-surface-2 p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex h-9 items-center rounded px-3 text-sm font-medium"
                  style={{ background: p.bg.hex, color: p.fg.hex }}
                >
                  {ROLE_LABELS[p.fg.role]}
                </span>
                <span className="text-sm text-muted">
                  {ROLE_LABELS[p.fg.role]} on {ROLE_LABELS[p.bg.role]}
                </span>
                <span className="font-mono text-sm text-fg">
                  {p.ratio.toFixed(2)}:1
                </span>
                <LevelBadge level={p.level} />
              </div>

              {(p.level === 'fail' || p.level === 'AA-large') && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {canFix ? (
                    <>
                      <span className="text-muted">Preview fix:</span>
                      <Chip hex={p.fg.hex} label="now" />
                      <ArrowRightIcon className="text-muted" width={14} height={14} />
                      <Chip hex={fix!.hex} label={`${fix!.ratio.toFixed(1)}:1`} />
                      <Button
                        variant="primary"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => onUpdate(p.fg.id, fix!.hex)}
                      >
                        Apply
                      </Button>
                    </>
                  ) : p.fg.locked ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <LockIcon width={12} height={12} /> Locked — unlock the card
                      to let marianne adjust it.
                    </span>
                  ) : (
                    <span className="text-xs text-muted">
                      Can’t reach AA by lightness alone; try a different hue.
                    </span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function LevelBadge({ level }: { level: string }) {
  if (level === 'AAA') return <Badge tone="good">AAA — excellent</Badge>
  if (level === 'AA') return <Badge tone="good">AA — passes</Badge>
  if (level === 'AA-large') return <Badge tone="warn">large text only</Badge>
  return <Badge tone="bad">fails</Badge>
}

function Chip({ hex, label }: { hex: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <ColorChip hex={hex} className="h-5 w-5" />
      <span className="font-mono text-xs text-fg">{label}</span>
    </span>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
      {children}
    </div>
  )
}
