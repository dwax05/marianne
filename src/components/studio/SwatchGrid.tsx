import { useEffect, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import {
  AnimatePresence,
  Reorder,
  useDragControls,
  useReducedMotion,
} from 'motion/react'
import type { Palette, Role } from '../../color/types'
import { ROLE_LABELS } from '../../color/types'
import { normalizeHex, toOklch } from '../../color/convert'
import { Button, IconButton } from '../ui/Button'
import type { RoleAssignment } from '../../color/roles'
import { RoleSuggestReview } from './RoleSuggestReview'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DropperIcon,
  GripIcon,
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
  onReorder: (ids: readonly string[]) => boolean
  onRemove: (id: string) => void
  onAdd: () => void
  onSetRoles: (assignments: readonly RoleAssignment[]) => boolean
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

const DRAG_EDGE_ELASTICITY = {
  top: 0.08,
  right: 0,
  bottom: 0.08,
  left: 0,
} as const

export function SwatchGrid({
  palette,
  onUpdate,
  onRole,
  onToggleLock,
  onReorder,
  onRemove,
  onAdd,
  onSetRoles,
}: Props) {
  const reduceMotion = useReducedMotion()
  const reorderBoundsRef = useRef<HTMLDivElement>(null)
  const [orderedPalette, setOrderedPalette] = useState(palette)
  const orderedPaletteRef = useRef(palette)
  const [moveAnnouncement, setMoveAnnouncement] = useState('')

  useEffect(() => {
    orderedPaletteRef.current = palette
    setOrderedPalette(palette)
  }, [palette])

  const updateOrder = (next: Palette) => {
    orderedPaletteRef.current = next
    setOrderedPalette(next)
  }

  const commitOrder = (id: string, hex: string) => {
    const ids = orderedPaletteRef.current.map((swatch) => swatch.id)
    if (!onReorder(ids)) return
    const position = ids.indexOf(id) + 1
    setMoveAnnouncement(
      `${hex.toUpperCase()} moved to position ${position} of ${ids.length}.`,
    )
  }

  const moveWithKeyboard = (
    id: string,
    hex: string,
    direction: 'up' | 'down',
  ) => {
    const from = orderedPaletteRef.current.findIndex(
      (swatch) => swatch.id === id,
    )
    const to = from + (direction === 'up' ? -1 : 1)
    if (from === -1 || to < 0 || to >= orderedPaletteRef.current.length) {
      return
    }
    const next = [...orderedPaletteRef.current]
    const displaced = next[to]
    next[to] = next[from]
    next[from] = displaced
    updateOrder(next)
    commitOrder(id, hex)
  }

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

      <RoleSuggestReview palette={palette} onApply={onSetRoles} />

      <div ref={reorderBoundsRef} className="relative">
        <Reorder.Group
          axis="y"
          values={orderedPalette}
          onReorder={updateOrder}
          as="div"
          role="list"
          aria-label="Palette colors"
          className="space-y-2"
        >
          {/* initial={false} skips the enter animation for swatches present on
              first render, so only colors added later actually animate in. */}
          <AnimatePresence initial={false}>
            {orderedPalette.map((swatch) => (
              <DraggableSwatch
                key={swatch.id}
                swatch={swatch}
                constraintsRef={reorderBoundsRef}
                reduceMotion={reduceMotion ?? false}
                onChange={(hex) => onUpdate(swatch.id, hex)}
                onRole={(role) => onRole(swatch.id, role)}
                onKeyboardMove={(direction) =>
                  moveWithKeyboard(swatch.id, swatch.hex, direction)
                }
                onDragStart={() =>
                  setMoveAnnouncement(`${swatch.hex.toUpperCase()} picked up.`)
                }
                onDragEnd={() => commitOrder(swatch.id, swatch.hex)}
                onToggleLock={() => onToggleLock(swatch.id)}
                onRemove={() => onRemove(swatch.id)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {moveAnnouncement}
      </p>
      {palette.length === 0 && (
        <p className="text-sm text-muted">No colors yet — add one to start.</p>
      )}
    </div>
  )
}

function DraggableSwatch({
  swatch,
  constraintsRef,
  reduceMotion,
  onChange,
  onRole,
  onKeyboardMove,
  onDragStart,
  onDragEnd,
  onToggleLock,
  onRemove,
}: {
  swatch: Palette[number]
  constraintsRef: RefObject<HTMLDivElement | null>
  reduceMotion: boolean
  onChange: (hex: string) => void
  onRole: (role: Role) => void
  onKeyboardMove: (direction: 'up' | 'down') => void
  onDragStart: () => void
  onDragEnd: () => void
  onToggleLock: () => void
  onRemove: () => void
}) {
  const dragControls = useDragControls()

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragControls.start(event)
  }

  const handleReorderKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    onKeyboardMove(event.key === 'ArrowUp' ? 'up' : 'down')
  }

  return (
    <Reorder.Item
      as="div"
      value={swatch}
      role="listitem"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={constraintsRef}
      dragElastic={DRAG_EDGE_ELASTICITY}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      whileDrag={
        reduceMotion
          ? { zIndex: 20 }
          : {
              zIndex: 20,
              boxShadow: '0 18px 34px rgba(35, 24, 16, 0.28)',
            }
      }
      transition={
        reduceMotion
          ? { layout: { duration: 0 }, duration: 0 }
          : {
              layout: {
                type: 'spring',
                stiffness: 500,
                damping: 38,
                mass: 0.7,
              },
              duration: 0.24,
              ease: [0.22, 1, 0.36, 1],
            }
      }
      className="group relative rounded-xl will-change-transform"
    >
      <Card
        hex={swatch.hex}
        role={swatch.role}
        locked={swatch.locked}
        onChange={onChange}
        onRole={onRole}
        onGripPointerDown={startDrag}
        onGripKeyDown={handleReorderKey}
        onToggleLock={onToggleLock}
        onRemove={onRemove}
      />
    </Reorder.Item>
  )
}

function Card({
  hex,
  role,
  locked,
  onChange,
  onRole,
  onGripPointerDown,
  onGripKeyDown,
  onToggleLock,
  onRemove,
}: {
  hex: string
  role: Role
  locked: boolean
  onChange: (hex: string) => void
  onRole: (role: Role) => void
  onGripPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onGripKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
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
    <div className="flex items-center gap-2 rounded-xl border border-line/50 bg-surface p-2 shadow-lg shadow-[#7d684f]/15 transition-[background-color,border-color,box-shadow] duration-150 group-hover:border-accent/60 group-hover:bg-surface-2/60 group-hover:shadow-xl group-hover:shadow-[#7d684f]/25">
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
        <button
          type="button"
          onPointerDown={onGripPointerDown}
          onKeyDown={onGripKeyDown}
          className="flex h-8 w-5 touch-none cursor-grab items-center justify-center rounded text-muted transition-colors group-hover:text-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
          aria-label={`Drag ${hex} to reorder. Use arrow keys to move it.`}
          title="Drag to reorder"
        >
          <GripIcon width={16} height={20} />
        </button>
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
