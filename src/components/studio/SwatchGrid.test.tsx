// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Palette } from '../../color/types'
import { SwatchGrid } from './SwatchGrid'

const palette: Palette = [
  { id: 'a', hex: '#111111', role: 'text', locked: false },
  { id: 'b', hex: '#ffffff', role: 'background', locked: false },
  { id: 'c', hex: '#3a7bd5', role: 'primary', locked: false },
]

describe('SwatchGrid reordering', () => {
  it('uses one drag grip with hover feedback and an arrow-key fallback', () => {
    const onReorder = vi.fn(() => true)
    render(
      <SwatchGrid
        palette={palette}
        onUpdate={vi.fn()}
        onRole={vi.fn()}
        onToggleLock={vi.fn()}
        onReorder={onReorder}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        onClear={vi.fn()}
        onGenerate={vi.fn()}
        onSetRoles={vi.fn(() => true)}
        onSimplify={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /Move .* (up|down)/ })).toBeNull()
    const blueGrip = screen.getByRole('button', {
      name: 'Drag #3a7bd5 to reorder. Use arrow keys to move it.',
    })
    expect(blueGrip).toHaveClass('cursor-grab')
    expect(blueGrip.closest('.group')?.firstElementChild).toHaveClass(
      'group-hover:border-accent/60',
    )

    blueGrip.focus()
    fireEvent.keyDown(blueGrip, { key: 'ArrowUp' })

    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b'])
    expect(screen.getByRole('status')).toHaveTextContent(
      '#3A7BD5 moved to position 2 of 3.',
    )
    expect(
      screen.getAllByRole('button', { name: /Drag .* to reorder/ })[1],
    ).toHaveAccessibleName(
      'Drag #3a7bd5 to reorder. Use arrow keys to move it.',
    )
    expect(blueGrip).toHaveFocus()
  })

  it('offers clear for a populated palette and creation paths when empty', () => {
    const onClear = vi.fn()
    const onAdd = vi.fn()
    const onGenerate = vi.fn()
    const common = {
      onUpdate: vi.fn(),
      onRole: vi.fn(),
      onToggleLock: vi.fn(),
      onReorder: vi.fn(() => true),
      onRemove: vi.fn(),
      onAdd,
      onClear,
      onGenerate,
      onSetRoles: vi.fn(() => true),
      onSimplify: vi.fn(),
    }
    const { rerender } = render(<SwatchGrid palette={palette} {...common} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear palette' }))
    expect(onClear).toHaveBeenCalledOnce()

    rerender(<SwatchGrid palette={[]} {...common} />)

    expect(screen.getByRole('heading', { name: 'Palette' }).parentElement).toHaveClass(
      'min-h-8',
    )
    expect(screen.queryByRole('button', { name: 'Clear palette' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Auto-suggest roles' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Generate a palette' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add one manually' }))
    expect(onGenerate).toHaveBeenCalledOnce()
    expect(onAdd).toHaveBeenCalledOnce()
  })
})
