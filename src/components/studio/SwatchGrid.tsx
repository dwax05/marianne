import { useEffect, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import type { Palette, Role } from '../../color/types'
import { ROLE_LABELS } from '../../color/types'
import { normalizeHex, toOklch } from '../../color/convert'
import { paletteToCss } from '../../color/css'
import { sortPaletteByLightness } from '../../color/balance'
import { Button, IconButton } from '../ui/Button'
import type { RoleAssignment } from '../../color/roles'
import { RoleSuggestReview } from './RoleSuggestReview'
import { PaletteSimplifySuggestion } from './PaletteSimplifySuggestion'
import {
  CheckIcon,
  BalanceIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DropperIcon,
  GripIcon,
  LockIcon,
  PlusIcon,
  SwatchesIcon,
  TrashIcon,
  UnlockIcon,
} from '../ui/icons'

const PAGE_SIZE = 8

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
  onClear: () => void
  onGenerate: () => void
  onSetRoles: (assignments: readonly RoleAssignment[]) => boolean
  onSimplify: (palette: Palette) => void
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
  onClear,
  onGenerate,
  onSetRoles,
  onSimplify,
}: Props) {
  const reduceMotion = useReducedMotion()
  const reorderBoundsRef = useRef<HTMLDivElement>(null)
  const [orderedPalette, setOrderedPalette] = useState(palette)
  const orderedPaletteRef = useRef(palette)
  const [moveAnnouncement, setMoveAnnouncement] = useState('')
  const [cssCopied, setCssCopied] = useState(false)
  const [page, setPage] = useState(0)
  const prevLenRef = useRef(palette.length)

  useEffect(() => {
    orderedPaletteRef.current = palette
    setOrderedPalette(palette)
    const pageCount = Math.max(1, Math.ceil(palette.length / PAGE_SIZE))
    // A just-added color is appended at the end — jump to its page so the new
    // swatch (and its role dropdown) stays in view. Otherwise clamp in range.
    setPage((current) =>
      palette.length > prevLenRef.current
        ? pageCount - 1
        : Math.min(current, pageCount - 1),
    )
    prevLenRef.current = palette.length
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
    // Keep the moved swatch visible if it crossed a page boundary.
    setPage(Math.floor(to / PAGE_SIZE))
  }

  const pageCount = Math.max(1, Math.ceil(orderedPalette.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const start = currentPage * PAGE_SIZE
  const pageItems = orderedPalette.slice(start, start + PAGE_SIZE)

  const reorderPage = (nextPage: Palette) =>
    updateOrder([
      ...orderedPalette.slice(0, start),
      ...nextPage,
      ...orderedPalette.slice(start + PAGE_SIZE),
    ])

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(paletteToCss(palette))
      setCssCopied(true)
      window.setTimeout(() => setCssCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-8 items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Palette
          {palette.length > 0 && (
            <span className="ml-1.5 tabular-nums text-muted/60">
              {palette.length}
            </span>
          )}
        </h2>
        {palette.length > 0 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="px-2 text-xs"
              onClick={onClear}
              title="Clear every color (undoable)"
            >
              <TrashIcon width={14} height={14} /> Clear palette
            </Button>
            <Button variant="primary" onClick={onAdd}>
              <PlusIcon /> Add color
            </Button>
          </div>
        )}
      </div>

      {palette.length === 0 ? (
        <EmptyPalette onAdd={onAdd} onGenerate={onGenerate} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="surface"
              className="text-xs"
              onClick={() =>
                onReorder(
                  sortPaletteByLightness(palette).map((swatch) => swatch.id),
                )
              }
              title="Sort darkest to lightest (undoable)"
            >
              <BalanceIcon /> Sort palette
            </Button>
            <Button variant="surface" className="text-xs" onClick={copyCss}>
              {cssCopied ? <CheckIcon /> : <CopyIcon />}
              {cssCopied ? 'CSS copied' : 'Copy as CSS'}
            </Button>
          </div>

          <PaletteSimplifySuggestion palette={palette} onApply={onSimplify} />

          <RoleSuggestReview palette={palette} onApply={onSetRoles} />

          <div ref={reorderBoundsRef} className="relative">
            <Reorder.Group
              axis="y"
              values={pageItems}
              onReorder={reorderPage}
              as="div"
              role="list"
              aria-label="Palette colors"
              className="space-y-2"
            >
              {/* No AnimatePresence: an exiting item held in the tree while it is
                  already dropped from the sliced `values` breaks Reorder's layout
                  projection (stranding items low). Reorder.Item's own `layout`
                  slides survivors up on delete and settles new pages in place. */}
              {pageItems.map((swatch) => (
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
            </Reorder.Group>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-2">
              <IconButton
                onClick={() => setPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                title="Previous colors"
                className="h-7 w-7"
              >
                <ChevronLeftIcon width={14} height={14} />
              </IconButton>
              <span className="text-xs tabular-nums text-muted">
                {currentPage + 1} / {pageCount}
              </span>
              <IconButton
                onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
                disabled={currentPage === pageCount - 1}
                title="More colors"
                className="h-7 w-7"
              >
                <ChevronRightIcon width={14} height={14} />
              </IconButton>
            </div>
          )}
        </>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {moveAnnouncement}
      </p>
    </div>
  )
}

function EmptyPalette({
  onAdd,
  onGenerate,
}: {
  onAdd: () => void
  onGenerate: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-line/70 bg-surface/60 p-4 text-center">
      <h3 className="text-sm font-semibold text-fg">Start a new palette</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Generate a harmonious set or add your first color by hand.
      </p>
      <div className="mt-3 grid gap-2">
        <Button variant="primary" onClick={onGenerate}>
          <SwatchesIcon /> Generate a palette
        </Button>
        <Button variant="surface" onClick={onAdd}>
          <PlusIcon /> Add one manually
        </Button>
      </div>
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
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
    <div className="flex items-center gap-2 rounded-xl border border-line/50 bg-surface p-2 shadow-lg shadow-[color:rgb(var(--card-shadow)_/_0.15)] transition-[background-color,border-color,box-shadow] duration-150 group-hover:border-accent/60 group-hover:bg-surface-2/60 group-hover:shadow-xl group-hover:shadow-[color:rgb(var(--card-shadow)_/_0.25)]">
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
