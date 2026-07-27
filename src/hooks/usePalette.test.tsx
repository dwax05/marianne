// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePalette } from './usePalette'

describe('usePalette.setRoles', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '#/app')
  })

  it('rejects the whole batch without changing palette or history', () => {
    window.history.replaceState(
      null,
      '',
      '#/app?p=ffffff.b-111111-3a7bd5!',
    )
    const { result } = renderHook(() => usePalette())
    const before = result.current.palette
    const unsetId = before[1].id
    const lockedId = before[2].id
    let accepted = true

    act(() => {
      accepted = result.current.setRoles([
        { swatchId: unsetId, role: 'text' },
        { swatchId: lockedId, role: 'accent' },
      ])
    })

    expect(accepted).toBe(false)
    expect(result.current.palette).toBe(before)
    expect(result.current.canUndo).toBe(false)
  })

  it('commits a successful batch once and one Undo restores every role', () => {
    window.history.replaceState(
      null,
      '',
      '#/app?p=ffffff.b-111111-3a7bd5',
    )
    const { result } = renderHook(() => usePalette())
    const before = result.current.palette.map((swatch) => ({ ...swatch }))
    let accepted = false

    act(() => {
      accepted = result.current.setRoles([
        { swatchId: result.current.palette[1].id, role: 'text' },
        { swatchId: result.current.palette[2].id, role: 'accent' },
      ])
    })

    expect(accepted).toBe(true)
    expect(result.current.palette.map((swatch) => swatch.role)).toEqual([
      'background',
      'text',
      'accent',
    ])
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())

    expect(result.current.palette).toEqual(before)
    expect(result.current.canUndo).toBe(false)
  })

  it('commits a validated drag order once and Undo restores the prior order', () => {
    window.history.replaceState(
      null,
      '',
      '#/app?p=ffffff-111111-3a7bd5',
    )
    const { result } = renderHook(() => usePalette())
    const before = result.current.palette.map((swatch) => ({ ...swatch }))
    let reordered = false

    act(() => {
      reordered = result.current.reorderSwatches([
        before[0].id,
        before[0].id,
        before[2].id,
      ])
    })
    expect(reordered).toBe(false)
    expect(result.current.canUndo).toBe(false)

    act(() => {
      reordered = result.current.reorderSwatches([
        before[2].id,
        before[0].id,
        before[1].id,
      ])
    })
    expect(reordered).toBe(true)
    expect(result.current.palette.map((swatch) => swatch.id)).toEqual([
      before[2].id,
      before[0].id,
      before[1].id,
    ])
    expect(result.current.palette[0]).toEqual(before[2])
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.palette).toEqual(before)
    expect(result.current.canUndo).toBe(false)
  })
})
