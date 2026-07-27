import { useEffect, useRef, useState } from 'react'
import type { Palette, Role } from '../../color/types'
import { ROLE_LABELS } from '../../color/types'
import { normalizeHex, toOklch } from '../../color/convert'
import { Button, IconButton } from '../ui/Button'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DropperIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
  UnlockIcon,
} from '../ui/icons'

interface EyeDropperResult {
  sRGBHex: string
}
interface EyeDropperCtor {
  new (): { open: () => Promise<EyeDropperResult> }
}
const hasEyeDropper = () => typeof (window as unknown as { EyeDropper?: unknown }).EyeDropper === 'function'

interface Props {
  palette: Palette
  onUpdate: (id: string, hex: string) => void
  onRole: (id: string, role: Role) => void
  onToggleLock: (id: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}

const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: 'General', roles: ['unset', 'background', 'text'] },
  { label: 'Brand', roles: ['hero', 'primary', 'accent'] },
  { label: 'Accent variants', roles: ['light-accent', 'dark-accent'] },
  {
    label: 'Neutrals',
    roles: ['light-neutral', 'neutral', 'dark-neutral'],
  },
]

export function SwatchGrid({
  palette,
  onUpdate,
  onRole,
  onToggleLock,
  onRemove,
  onAdd,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Palette
        </h2>
        <Button variant="primary" onClick={onAdd}>
          <PlusIcon /> Add color
        </Button>
      </div>

      <div className="space-y-2">
        {palette.map((s) => (
          <Card
            key={s.id}
            hex={s.hex}
            role={s.role}
            locked={s.locked}
            onChange={(hex) => onUpdate(s.id, hex)}
            onRole={(role) => onRole(s.id, role)}
            onToggleLock={() => onToggleLock(s.id)}
            onRemove={() => onRemove(s.id)}
          />
        ))}
      </div>
      {palette.length === 0 && (
        <p className="text-sm text-muted">No colors yet — add one to start.</p>
      )}
    </div>
  )
}

function Card({
  hex,
  role,
  locked,
  onChange,
  onRole,
  onToggleLock,
  onRemove,
}: {
  hex: string
  role: Role
  locked: boolean
  onChange: (hex: string) => void
  onRole: (role: Role) => void
  onToggleLock: () => void
  onRemove: () => void
}) {
  const [text, setText] = useState(hex)
  const inputRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(hex)
  }, [hex])

  const commit = (raw: string) => {
    const norm = normalizeHex(raw)
    if (norm) {
      setText(norm)
      onChange(norm)
    } else setText(hex)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const pick = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
    if (!Ctor) return
    try {
      const { sRGBHex } = await new Ctor().open()
      const norm = normalizeHex(sRGBHex)
      if (norm) onChange(norm)
    } catch {
      /* user cancelled */
    }
  }

  const light = (toOklch(hex)?.l ?? 0.5) > 0.6

  return (
    <div className="flex items-center gap-2 rounded-xl border border-line/50 bg-surface p-2 shadow-lg shadow-[#7d684f]/15">
      <div className="relative h-11 w-11 shrink-0">
        <Button
          variant="paint"
          onClick={() => colorRef.current?.click()}
          className="relative h-full w-full rounded-lg border border-line/40"
          style={{ background: hex }}
          aria-label="Change color"
          title="Click to change color"
        >
          {locked && (
            <span
              className={`absolute right-0.5 top-0.5 ${light ? 'text-black/60' : 'text-white/80'}`}
            >
              <LockIcon width={12} height={12} />
            </span>
          )}
        </Button>
        <input
          ref={colorRef}
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          tabIndex={-1}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(e.currentTarget.value)
            if (e.key === 'Escape') setText(hex)
          }}
          className="-ml-1 w-full rounded bg-transparent px-1 font-mono text-sm uppercase tracking-wide text-fg focus:outline-none focus:ring-2 focus:ring-accent/35"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          title="Enter a hex color with or without #"
          aria-label="Hex value"
        />
        <div className="relative mt-1 w-fit max-w-full">
          <select
            value={role}
            onChange={(e) => onRole(e.target.value as Role)}
            className="max-w-full appearance-none rounded-md border border-line/60 bg-surface-2 py-0.5 pl-2 pr-6 text-xs font-medium text-fg focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Color role"
          >
            {ROLE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDownIcon
            width={12}
            height={12}
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {hasEyeDropper() && (
          <IconButton onClick={pick} title="Pick color from screen" className="h-7 w-7">
            <DropperIcon width={14} height={14} />
          </IconButton>
        )}
        <IconButton onClick={copy} title="Copy hex" className="h-7 w-7">
          {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
        </IconButton>
        <IconButton
          onClick={onToggleLock}
          active={locked}
          title={locked ? 'Unlock' : 'Lock (protect from fixes)'}
          className="h-7 w-7"
        >
          {locked ? <LockIcon width={14} height={14} /> : <UnlockIcon width={14} height={14} />}
        </IconButton>
        <IconButton onClick={onRemove} danger title="Delete" className="h-7 w-7">
          <TrashIcon width={14} height={14} />
        </IconButton>
      </div>
    </div>
  )
}
