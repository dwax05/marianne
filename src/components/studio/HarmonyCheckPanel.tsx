import { useMemo, useState } from 'react'
import type { Palette } from '../../color/types'
import {
  analyzeHarmony,
  applyHarmonyFixes,
  type HarmonyIssue,
} from '../../color/audit'
import { Button } from '../ui/Button'
import { AlertIcon, CloseIcon, LockIcon } from '../ui/icons'

interface Props {
  palette: Palette
  onApply: (palette: Palette) => void
}

export function HarmonyCheckPanel({ palette, onApply }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const issues = useMemo(() => analyzeHarmony(palette), [palette])
  const visibleIssues = issues.filter((issue) => !dismissed.includes(issue.id))
  const applicableIssues = visibleIssues.filter((issue) => !issue.locked)

  const apply = (issue: HarmonyIssue) => {
    if (issue.locked) return
    onApply(applyHarmonyFixes(palette, [issue]))
  }

  if (visibleIssues.length === 0) {
    const dismissedAll = issues.length > 0
    return (
      <div className="flex items-start gap-2 rounded-xl border border-good/25 bg-good/10 p-3 text-sm text-good">
        <span className="mt-0.5">✓</span>
        <div>
          <div className="font-medium">
            {dismissedAll ? 'No active suggestions' : 'Colors feel consistent'}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {dismissedAll
              ? 'You dismissed the current harmony suggestions. They will return if those colors change.'
              : 'No strong saturation or lightness outliers found.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warn/10 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-fg">
          <span className="text-warn">
            <AlertIcon />
          </span>
          {visibleIssues.length}{' '}
          {visibleIssues.length === 1 ? 'color could' : 'colors could'} be balanced
        </div>
        <Button
          variant="primary"
          onClick={() => onApply(applyHarmonyFixes(palette, applicableIssues))}
          disabled={applicableIssues.length === 0}
        >
          Apply all fixes
        </Button>
      </div>

      <div className="space-y-3">
        {visibleIssues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onApply={() => apply(issue)}
            onDismiss={() => setDismissed((ids) => [...ids, issue.id])}
          />
        ))}
      </div>
    </div>
  )
}

function IssueCard({
  issue,
  onApply,
  onDismiss,
}: {
  issue: HarmonyIssue
  onApply: () => void
  onDismiss: () => void
}) {
  return (
    <article className="rounded-xl border border-line/50 bg-surface-2 p-3">
      <div className="grid grid-cols-2 gap-3">
        <ColorPreview label="Current" hex={issue.currentHex} />
        <ColorPreview label="Suggested" hex={issue.suggestedHex} />
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-semibold text-fg">{issue.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {issue.description}
        </p>
        {issue.locked && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-warn">
            <LockIcon width={13} height={13} /> Unlock this color to apply its
            fix.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-line/40 pt-3">
        <Button variant="ghost" onClick={onDismiss}>
          <CloseIcon /> Dismiss
        </Button>
        <Button variant="primary" onClick={onApply} disabled={issue.locked}>
          Apply fix
        </Button>
      </div>
    </article>
  )
}

function ColorPreview({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <div
        className="h-14 rounded-lg border border-line/30"
        style={{ background: hex }}
      />
      <div className="mt-1 truncate font-mono text-xs uppercase text-muted">
        {hex}
      </div>
    </div>
  )
}
