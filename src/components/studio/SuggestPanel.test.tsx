// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Palette } from '../../color/types'
import { SuggestPanel } from './SuggestPanel'

const palette: Palette = [
  { id: 'bg', hex: '#ffffff', role: 'background', locked: false },
  { id: 'primary', hex: '#3a7bd5', role: 'primary', locked: false },
  { id: 'accent', hex: '#e5484d', role: 'accent', locked: false },
]

describe('SuggestPanel wanted color', () => {
  it('previews immediately and adds with the selected refinements', () => {
    const onAdd = vi.fn()
    render(
      <SuggestPanel
        palette={palette}
        onAdd={onAdd}
        onAddMany={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Wanted color' }), {
      target: { value: 'green' },
    })

    expect(screen.getByText('Matching green')).toBeInTheDocument()
    const role = screen.getByRole('combobox', { name: 'Wanted color role' })
    const contrast = screen.getByRole('checkbox', {
      name: 'Require AA contrast',
    })
    expect(role).toHaveValue('accent')
    expect(contrast).toBeChecked()

    fireEvent.change(role, { target: { value: 'primary' } })
    fireEvent.click(contrast)

    fireEvent.click(
      screen.getByRole('button', { name: 'Add matching green' }),
    )

    expect(onAdd).toHaveBeenCalledWith(
      expect.stringMatching(/^#[0-9a-f]{6}$/),
      'primary',
    )
  })
})
