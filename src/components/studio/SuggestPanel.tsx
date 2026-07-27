import { useMemo, useState } from 'react'
import type { Palette, Role } from '../../color/types'
import { FOREGROUND_ROLES, ROLE_LABELS } from '../../color/types'
import {
  suggestAdditions,
  suggestWantedColor,
} from '../../color/suggest'
import type { WantedColorRole } from '../../color/suggest'
import { Button } from '../ui/Button'
import { ColorInputRow } from '../ui/ColorInputRow'
import { PlusIcon } from '../ui/icons'

interface Props {
  palette: Palette
  onAdd: (hex: string, role?: Role) => void
  onAddMany: (items: { hex: string; role?: Role }[]) => void
}

const WANTED_COLOR_ROLES = Object.keys(ROLE_LABELS).filter(
  (role): role is WantedColorRole => role !== 'unset',
)

export function SuggestPanel({ palette, onAdd, onAddMany }: Props) {
  const paletteBg =
    palette.find((swatch) => swatch.role === 'background')?.hex ?? '#ffffff'
  const hasPaletteBg = palette.some((swatch) => swatch.role === 'background')
  const [customBg, setCustomBg] = useState<string | null>(null)
  const [wanted, setWanted] = useState('')
  const [wantedRole, setWantedRole] = useState<WantedColorRole>('accent')
  const [requireContrast, setRequireContrast] = useState(true)
  const [showInputError, setShowInputError] = useState(false)
  const bg = customBg ?? paletteBg
  const requested = wanted.trim()
  const wantedRoleUsesContrast = FOREGROUND_ROLES.includes(wantedRole)
  const setBg = (hex: string) =>
    setCustomBg(hex.toLowerCase() === paletteBg.toLowerCase() ? null : hex)
  const suggestions = useMemo(
    () => suggestAdditions(palette, { targetContrastBg: bg }),
    [palette, bg],
  )
  const wantedResult = useMemo(
    () =>
      requested
        ? suggestWantedColor(palette, {
            color: requested,
            role: wantedRole,
            targetContrastBg:
              requireContrast && wantedRoleUsesContrast ? bg : undefined,
          })
        : null,
    [
      palette,
      requested,
      wantedRole,
      requireContrast,
      wantedRoleUsesContrast,
      bg,
    ],
  )
  const requestColor = (color: string) => {
    const trimmed = color.trim()
    if (!trimmed) return
    setWanted(trimmed)
    setShowInputError(false)
  }
  // Neutral anchors clear the coverage check only as a pair, so offer them as a
  // single action when both are missing.
  const neutralPair = suggestions.filter(
    (s) => s.kind === 'light-neutral' || s.kind === 'dark-neutral',
  )
  const showBundle = neutralPair.length === 2

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
        <div>
          <div className="text-xs font-semibold text-fg">
            Find a matching color
          </div>
          <div className="text-[11px] text-muted">
            Name a color and marianne will fit its hue to your palette’s
            lightness and intensity.
          </div>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setShowInputError(true)
          }}
        >
          <input
            type="text"
            value={wanted}
            onChange={(event) => {
              setWanted(event.target.value)
              setShowInputError(false)
            }}
            placeholder="green, teal, #22c55e"
            aria-label="Wanted color"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            className="min-w-44 flex-1 rounded-lg border border-line/60 bg-surface px-3 py-1.5 text-xs text-fg placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
          <Button variant="primary" type="submit" className="text-xs">
            Suggest color
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted">Try</span>
          {['green', 'blue', 'orange', 'purple'].map((color) => (
            <Button
              key={color}
              variant="ghost"
              className="px-2 py-0.5 text-[11px] capitalize"
              onClick={() => requestColor(color)}
              aria-label={`Suggest ${color}`}
            >
              {color}
            </Button>
          ))}
        </div>

        <details className="rounded-lg border border-line/40 bg-surface/60 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            Refine
          </summary>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-[11px] text-muted">
              Role
              <select
                value={wantedRole}
                onChange={(event) =>
                  setWantedRole(event.target.value as WantedColorRole)
                }
                aria-label="Wanted color role"
                className="rounded-lg border border-line/60 bg-surface px-2 py-1.5 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent/35"
              >
                {WANTED_COLOR_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={requireContrast}
                disabled={!wantedRoleUsesContrast}
                onChange={(event) => setRequireContrast(event.target.checked)}
                aria-label="Require AA contrast"
                className="accent-accent"
              />
              Require AA contrast
            </label>
          </div>
        </details>

        {wantedResult?.status === 'ready' && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 p-3">
            <span
              className="h-12 w-12 shrink-0 rounded-lg border border-line/40"
              style={{ background: wantedResult.suggestion.hex }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-fg">
                {wantedResult.suggestion.label}
              </div>
              <div className="font-mono text-xs uppercase text-muted">
                {wantedResult.suggestion.hex}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                Adds as {ROLE_LABELS[wantedResult.suggestion.role]}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {wantedResult.suggestion.reason}
              </p>
            </div>
            <Button
              variant="primary"
              className="px-3 py-1.5 text-xs"
              onClick={() =>
                onAdd(
                  wantedResult.suggestion.hex,
                  wantedResult.suggestion.role,
                )
              }
              aria-label={`Add matching ${requested}`}
            >
              <PlusIcon width={14} height={14} /> Add
            </Button>
          </div>
        )}
        {wantedResult &&
          wantedResult.status !== 'ready' &&
          (wantedResult.status !== 'invalid' || showInputError) && (
            <p
              role={
                wantedResult.status === 'already-present' ? 'status' : 'alert'
              }
              className="text-xs text-muted"
            >
              {wantedResult.message}
            </p>
          )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-2.5">
        <div>
          <div className="text-xs font-medium text-fg">Contrast target</div>
          <div className="text-[11px] text-muted">
            {customBg
              ? 'Custom background · checking WCAG AA'
              : hasPaletteBg
                ? 'Using your palette background · checking WCAG AA'
                : 'No palette background · defaulting to white'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColorInputRow
            hex={bg}
            label="target background"
            onChange={setBg}
          />
          {customBg && (
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => setCustomBg(null)}
            >
              Use palette background
            </Button>
          )}
        </div>
      </div>

      {showBundle && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-3">
            <span className="flex shrink-0 -space-x-2">
              {neutralPair.map((s) => (
                <span
                  key={s.kind}
                  className="h-9 w-9 rounded-lg border border-line/40"
                  style={{ background: s.hex }}
                />
              ))}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-fg">
                Add both neutral anchors
              </div>
              <div className="text-[11px] text-muted">
                A light and a dark neutral work as a pair — add both to complete
                your tonal range.
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            className="px-3 py-1.5 text-xs"
            onClick={() =>
              onAddMany(neutralPair.map((s) => ({ hex: s.hex, role: s.role })))
            }
          >
            <PlusIcon width={14} height={14} /> Add both
          </Button>
        </div>
      )}

      {suggestions.length === 0 ? (
        <p className="text-muted">
          No additions suggested. Light and dark neutral anchors are present,
          and at least one color meets AA against this background.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((s) => (
            <li
              key={s.kind}
              className={`flex min-h-36 flex-col rounded-xl border border-line/50 bg-surface-2 p-3 ${suggestions.length === 1 ? 'sm:col-span-2' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-12 w-12 shrink-0 rounded-lg border border-line/30"
                  style={{ background: s.hex }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-fg">{s.label}</div>
                  <div className="font-mono text-xs uppercase text-muted">
                    {s.hex}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    Adds as {ROLE_LABELS[s.role]}
                  </div>
                </div>
              </div>
              <p className="my-2 text-xs leading-relaxed text-muted">{s.reason}</p>
              <Button
                variant="primary"
                className="mt-auto w-full px-2.5 py-1 text-xs"
                onClick={() => onAdd(s.hex, s.role)}
              >
                <PlusIcon width={14} height={14} /> Add to palette
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
