import { useEffect, useRef, useState } from 'react'
import type { Palette } from '../../color/types'
import { ROLE_LABELS } from '../../color/types'
import type {
  AssignableRole,
  RoleAssignment,
  RoleCandidate,
  RoleSuggestion,
  RoleSuggestionSet,
} from '../../color/roles'
import {
  isUniqueAssistantRole,
  suggestRoles,
} from '../../color/roles'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SparkleIcon } from '../ui/icons'

interface Props {
  palette: Palette
  onApply: (assignments: readonly RoleAssignment[]) => boolean
}

interface RowState {
  checked: boolean
  role: AssignableRole
  error: string
}

export function RoleSuggestReview({ palette, onApply }: Props) {
  const paletteIdentity = useRef(palette)
  const [snapshot, setSnapshot] = useState<RoleSuggestionSet | null>(null)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [applyError, setApplyError] = useState('')

  useEffect(() => {
    if (paletteIdentity.current !== palette) {
      paletteIdentity.current = palette
      setSnapshot(null)
      setRows({})
      setApplyError('')
    }
  }, [palette])

  const open = () => {
    const next = suggestRoles(palette)
    setSnapshot(next)
    setRows(
      Object.fromEntries(
        next.suggestions.map((suggestion) => [
          suggestion.swatchId,
          {
            checked: suggestion.confidence !== 'low',
            role: suggestion.recommended.role,
            error: '',
          },
        ]),
      ),
    )
    setApplyError('')
  }

  const close = () => {
    setSnapshot(null)
    setRows({})
    setApplyError('')
  }

  if (!snapshot) {
    return (
      <Button variant="surface" className="w-full" onClick={open}>
        <SparkleIcon /> Auto-suggest roles
      </Button>
    )
  }

  const explicitUniqueRoles = new Set(
    palette
      .map((swatch) => swatch.role)
      .filter(isUniqueAssistantRole),
  )
  const roleAvailable = (role: AssignableRole, swatchId: string) => {
    if (!isUniqueAssistantRole(role)) return true
    if (explicitUniqueRoles.has(role)) return false
    return !Object.entries(rows).some(
      ([otherId, row]) =>
        otherId !== swatchId && row.checked && row.role === role,
    )
  }
  const checkedRows = Object.entries(rows).filter(([, row]) => row.checked)
  const checkedUniqueRoles = checkedRows
    .map(([, row]) => row.role)
    .filter(isUniqueAssistantRole)
  const hasConflict =
    new Set(checkedUniqueRoles).size !== checkedUniqueRoles.length ||
    checkedUniqueRoles.some((role) => explicitUniqueRoles.has(role))

  const toggleRow = (swatchId: string, checked: boolean) => {
    setRows((current) => {
      const row = current[swatchId]
      if (!row) return current
      if (checked && !roleAvailableFrom(current, explicitUniqueRoles, row.role, swatchId)) {
        return {
          ...current,
          [swatchId]: { ...row, checked: false, error: 'Choose another role.' },
        }
      }
      return {
        ...current,
        [swatchId]: { ...row, checked, error: '' },
      }
    })
    setApplyError('')
  }

  const selectRole = (swatchId: string, role: AssignableRole) => {
    setRows((current) => {
      const row = current[swatchId]
      if (!row) return current
      if (!roleAvailableFrom(current, explicitUniqueRoles, role, swatchId)) {
        return {
          ...current,
          [swatchId]: { ...row, error: 'Choose another role.' },
        }
      }
      return {
        ...current,
        [swatchId]: { ...row, role, error: '' },
      }
    })
    setApplyError('')
  }

  const apply = () => {
    const assignments = checkedRows.map(([swatchId, row]) => ({
      swatchId,
      role: row.role,
    }))
    if (assignments.length === 0 || hasConflict) return
    if (onApply(assignments)) {
      close()
      return
    }
    setApplyError(
      'The palette changed before these roles could be applied. Regenerate suggestions and try again.',
    )
  }

  return (
    <section
      aria-label="Role suggestions"
      className="rounded-xl border border-accent/30 bg-accent/5 p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-fg">Suggested roles</h3>
            <Badge tone="neutral">
              {capitalize(snapshot.interpretation)} palette
            </Badge>
            <Badge tone="neutral">
              {Math.round(snapshot.quality * 100)}% fit
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {snapshot.rationale}
          </p>
        </div>
      </div>

      {snapshot.suggestions.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          All colors already have roles or are locked. Set a color to No role or
          unlock it to include it.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {snapshot.suggestions.map((suggestion) => {
            const swatch = palette.find(
              (candidate) => candidate.id === suggestion.swatchId,
            )
            const row = rows[suggestion.swatchId]
            if (!swatch || !row) return null
            const candidates = suggestionCandidates(suggestion)
            const selected =
              candidates.find((candidate) => candidate.role === row.role) ??
              suggestion.recommended
            const checkboxId = `suggest-role-${suggestion.swatchId}`
            const selectId = `suggest-role-choice-${suggestion.swatchId}`

            return (
              <li
                key={suggestion.swatchId}
                className="rounded-lg border border-line/50 bg-surface p-2.5"
              >
                <div className="flex items-start gap-2">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={row.checked}
                    onChange={(event) =>
                      toggleRow(suggestion.swatchId, event.target.checked)
                    }
                    aria-label={`Apply ${swatch.hex} as ${ROLE_LABELS[row.role]}`}
                    className="mt-2 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-line/40"
                    style={{ background: swatch.hex }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label
                        htmlFor={checkboxId}
                        className="font-mono text-xs uppercase text-fg"
                      >
                        {swatch.hex}
                      </label>
                      <ConfidenceBadge confidence={suggestion.confidence} />
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                      {selected.reason}
                    </p>
                  </div>
                </div>

                <label htmlFor={selectId} className="sr-only">
                  Role for {swatch.hex}
                </label>
                <select
                  id={selectId}
                  value={row.role}
                  onChange={(event) =>
                    selectRole(
                      suggestion.swatchId,
                      event.target.value as AssignableRole,
                    )
                  }
                  className="mt-2 w-full rounded-md border border-line/60 bg-surface-2 px-2 py-1 text-xs font-medium text-fg focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {candidates.map((candidate) => (
                    <option
                      key={candidate.role}
                      value={candidate.role}
                      disabled={
                        candidate.role !== row.role &&
                        !roleAvailable(candidate.role, suggestion.swatchId)
                      }
                    >
                      {ROLE_LABELS[candidate.role]}
                    </option>
                  ))}
                </select>
                {row.error && (
                  <p role="alert" className="mt-1 text-xs text-bad">
                    {row.error}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {applyError && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-bad">
          {applyError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={apply}
          disabled={checkedRows.length === 0 || hasConflict}
        >
          Apply selected
        </Button>
      </div>
    </section>
  )
}

function roleAvailableFrom(
  rows: Record<string, RowState>,
  explicitUniqueRoles: Set<AssignableRole>,
  role: AssignableRole,
  swatchId: string,
): boolean {
  if (!isUniqueAssistantRole(role)) return true
  if (explicitUniqueRoles.has(role)) return false
  return !Object.entries(rows).some(
    ([otherId, row]) =>
      otherId !== swatchId && row.checked && row.role === role,
  )
}

function suggestionCandidates(suggestion: RoleSuggestion): RoleCandidate[] {
  const candidates = new Map<AssignableRole, RoleCandidate>()
  candidates.set(suggestion.recommended.role, suggestion.recommended)
  for (const candidate of suggestion.alternatives) {
    candidates.set(candidate.role, candidate)
  }
  return [...candidates.values()]
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: RoleSuggestion['confidence']
}) {
  const tone =
    confidence === 'high' ? 'good' : confidence === 'medium' ? 'warn' : 'neutral'
  return <Badge tone={tone}>{capitalize(confidence)} confidence</Badge>
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
