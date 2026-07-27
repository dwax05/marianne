import { useCallback, useEffect, useRef, useState } from 'react'
import type { Palette, Role, Swatch } from '../color/types'
import { SKELETON_HEX } from '../color/types'
import type { RoleAssignment } from '../color/roles'
import { applyRoleAssignments } from '../color/roles'
import { suggestForRole } from '../color/suggest'
import {
  decodePalette,
  encodePalette,
  loadLocal,
  makeSwatch,
  saveLocal,
} from '../color/encode'

const DEFAULT_PALETTE: Swatch[] = [
  { id: 'd0', hex: '#1b1b1f', role: 'text', locked: false },
  { id: 'd1', hex: '#ffffff', role: 'background', locked: false },
  { id: 'd2', hex: '#3a7bd5', role: 'primary', locked: false },
  { id: 'd3', hex: '#e5484d', role: 'accent', locked: false },
  { id: 'd4', hex: '#8a8f98', role: 'neutral', locked: false },
]

function defaultPalette(): Palette {
  return DEFAULT_PALETTE.map((s) => ({ ...s }))
}

/** Read palette from the URL hash `#/app?p=...`. */
function paletteFromHash(): Palette | null {
  const hash = window.location.hash
  const q = hash.indexOf('?')
  if (q === -1) return null
  const params = new URLSearchParams(hash.slice(q + 1))
  const p = params.get('p')
  if (!p) return null
  const decoded = decodePalette(p)
  return decoded.length ? decoded : null
}

function initialPalette(): Palette {
  return paletteFromHash() ?? loadLocal() ?? defaultPalette()
}

export interface UsePalette {
  palette: Palette
  /** Replace the palette, pushing the previous onto the undo stack. */
  commit: (p: Palette) => void
  addSwatch: (hex?: string, role?: Role) => void
  /** Add several swatches in one undoable commit. */
  addSwatches: (items: { hex: string; role?: Role }[]) => void
  updateSwatch: (id: string, hex: string) => void
  setRole: (id: string, role: Role) => void
  /** Assign several eligible semantic roles in one undoable commit. */
  setRoles: (assignments: readonly RoleAssignment[]) => boolean
  toggleLock: (id: string) => void
  /** Commit a complete swatch order in one undoable operation. */
  reorderSwatches: (ids: readonly string[]) => boolean
  removeSwatch: (id: string) => void
  reset: () => void
  undo: () => void
  canUndo: boolean
  shareUrl: () => string
}

export function usePalette(): UsePalette {
  const [palette, setPalette] = useState<Palette>(initialPalette)
  const [history, setHistory] = useState<Palette[]>([])
  const timer = useRef<number | undefined>(undefined)

  // Persist to localStorage + reflect in the URL hash (debounced).
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveLocal(palette)
      const base = window.location.hash.split('?')[0] || '#/app'
      window.history.replaceState(null, '', `${base}?p=${encodePalette(palette)}`)
    }, 250)
    return () => window.clearTimeout(timer.current)
  }, [palette])

  /** Snapshot current palette to history, then apply `next`. */
  const commit = useCallback(
    (next: Palette) => {
      setHistory((h) => [...h.slice(-49), palette])
      setPalette(next)
    },
    [palette],
  )

  const addSwatch = useCallback(
    (hex = SKELETON_HEX, role: Role = 'unset') => {
      const s = makeSwatch(hex, role)
      if (s) commit([...palette, s])
    },
    [palette, commit],
  )

  const addSwatches = useCallback(
    (items: { hex: string; role?: Role }[]) => {
      const made = items
        .map((it) => makeSwatch(it.hex, it.role ?? 'unset'))
        .filter((s): s is Swatch => s !== null)
      if (made.length) commit([...palette, ...made])
    },
    [palette, commit],
  )

  const updateSwatch = useCallback(
    (id: string, hex: string) => {
      commit(palette.map((s) => (s.id === id ? { ...s, hex } : s)))
    },
    [palette, commit],
  )

  const setRole = useCallback(
    (id: string, role: Role) => {
      commit(
        palette.map((s) => {
          if (s.id !== id) return s
          // A freshly-added swatch is still the gray skeleton — the moment it
          // gets a real role, fill in a palette-tinted color for that role.
          const hex =
            s.hex === SKELETON_HEX && role !== 'unset'
              ? suggestForRole(palette, role)
              : s.hex
          return { ...s, role, hex }
        }),
      )
    },
    [palette, commit],
  )

  const setRoles = useCallback(
    (assignments: readonly RoleAssignment[]) => {
      const next = applyRoleAssignments(palette, assignments)
      if (!next) return false
      commit(next)
      return true
    },
    [palette, commit],
  )

  const toggleLock = useCallback(
    (id: string) => {
      commit(palette.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)))
    },
    [palette, commit],
  )

  const reorderSwatches = useCallback(
    (ids: readonly string[]) => {
      if (ids.length !== palette.length) return false
      const byId = new Map(palette.map((swatch) => [swatch.id, swatch]))
      const seen = new Set<string>()
      const next: Palette = []
      for (const id of ids) {
        const swatch = byId.get(id)
        if (!swatch || seen.has(id)) return false
        seen.add(id)
        next.push(swatch)
      }
      if (next.every((swatch, index) => swatch === palette[index])) return false
      commit(next)
      return true
    },
    [palette, commit],
  )

  const removeSwatch = useCallback(
    (id: string) => {
      commit(palette.filter((s) => s.id !== id))
    },
    [palette, commit],
  )

  const reset = useCallback(() => {
    commit(defaultPalette())
  }, [commit])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setPalette(prev)
      return h.slice(0, -1)
    })
  }, [])

  const shareUrl = useCallback(() => {
    const { origin, pathname } = window.location
    return `${origin}${pathname}#/app?p=${encodePalette(palette)}`
  }, [palette])

  return {
    palette,
    commit,
    addSwatch,
    addSwatches,
    updateSwatch,
    setRole,
    setRoles,
    toggleLock,
    reorderSwatches,
    removeSwatch,
    reset,
    undo,
    canUndo: history.length > 0,
    shareUrl,
  }
}
