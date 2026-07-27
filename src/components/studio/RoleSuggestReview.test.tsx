// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { suggestRoles } from '../../color/roles'
import type { Palette } from '../../color/types'
import { RoleSuggestReview } from './RoleSuggestReview'

const reviewPalette: Palette = [
  { id: 's0', hex: '#ffffff', role: 'unset', locked: false },
  { id: 's1', hex: '#111111', role: 'unset', locked: false },
  { id: 's2', hex: '#3a7bd5', role: 'unset', locked: false },
  { id: 's3', hex: '#e5484d', role: 'unset', locked: false },
  { id: 's4', hex: '#8a8f98', role: 'unset', locked: false },
]

function openReview(
  palette: Palette = reviewPalette,
  onApply = vi.fn(() => true),
) {
  const view = render(
    <RoleSuggestReview palette={palette} onApply={onApply} />,
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Auto-suggest roles' }),
  )
  return { ...view, onApply }
}

describe('RoleSuggestReview', () => {
  it('opens a non-mutating snapshot with interpretation and confidence defaults', () => {
    const before = reviewPalette.map((swatch) => ({ ...swatch }))
    const model = suggestRoles(reviewPalette)
    const { onApply } = openReview()

    expect(
      screen.getByRole('region', { name: 'Role suggestions' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${capitalize(model.interpretation)} palette`),
    ).toBeInTheDocument()
    expect(screen.getByText(model.rationale)).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
    expect(reviewPalette).toEqual(before)

    for (const suggestion of model.suggestions) {
      const swatch = reviewPalette.find(
        (candidate) => candidate.id === suggestion.swatchId,
      )!
      expect(
        screen.getByRole('checkbox', { name: new RegExp(swatch.hex, 'i') }),
      ).toHaveProperty('checked', suggestion.confidence !== 'low')
    }
  })

  it('keeps low-confidence rows unchecked until the user opts in', () => {
    const palette: Palette = [
      { id: 'invalid', hex: 'not-a-color', role: 'unset', locked: false },
    ]
    openReview(palette)
    const checkbox = screen.getByRole('checkbox', { name: /not-a-color/i })
    const apply = screen.getByRole('button', { name: 'Apply selected' })

    expect(checkbox).not.toBeChecked()
    expect(apply).toBeDisabled()
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(apply).toBeEnabled()
  })

  it('supports alternative selection, unique claim release, and rejected re-check', () => {
    openReview()
    const whiteCheckbox = screen.getByRole('checkbox', { name: /#ffffff/i })
    const grayCheckbox = screen.getByRole('checkbox', { name: /#8a8f98/i })
    const whiteRole = screen.getByRole('combobox', {
      name: 'Role for #ffffff',
    })
    const grayRole = screen.getByRole('combobox', {
      name: 'Role for #8a8f98',
    })
    const grayLightNeutral = within(grayRole).getByRole('option', {
      name: 'Light neutral',
    })

    fireEvent.change(whiteRole, { target: { value: 'light-neutral' } })
    fireEvent.click(whiteCheckbox)
    expect(whiteCheckbox).toBeChecked()
    expect(grayLightNeutral).toBeDisabled()

    fireEvent.click(whiteCheckbox)
    expect(grayLightNeutral).toBeEnabled()
    fireEvent.change(grayRole, { target: { value: 'light-neutral' } })
    expect(grayCheckbox).toBeChecked()

    fireEvent.click(whiteCheckbox)
    expect(whiteCheckbox).not.toBeChecked()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose another role.')

    fireEvent.change(whiteRole, { target: { value: 'neutral' } })
    expect(screen.queryByText('Choose another role.')).not.toBeInTheDocument()
    fireEvent.click(whiteCheckbox)
    expect(whiteCheckbox).toBeChecked()
  })

  it('keeps reusable accent and neutral choices available to every row', () => {
    openReview()
    for (const select of screen.getAllByRole('combobox')) {
      expect(
        within(select).getByRole('option', { name: 'Accent' }),
      ).toBeEnabled()
      expect(
        within(select).getByRole('option', { name: 'Neutral' }),
      ).toBeEnabled()
    }
  })

  it('disables Apply with no selection and reports a failed final validation', () => {
    const palette: Palette = [
      { id: 'invalid', hex: 'not-a-color', role: 'unset', locked: false },
    ]
    const onApply = vi.fn(() => false)
    openReview(palette, onApply)
    const apply = screen.getByRole('button', { name: 'Apply selected' })
    expect(apply).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /not-a-color/i }))
    fireEvent.click(apply)

    expect(onApply).toHaveBeenCalledWith([
      { swatchId: 'invalid', role: 'neutral' },
    ])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The palette changed before these roles could be applied',
    )
  })

  it('closes after a successful apply and Cancel discards without applying', () => {
    const success = vi.fn(() => true)
    openReview(reviewPalette, success)
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected' }))
    expect(success).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Auto-suggest roles' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Auto-suggest roles' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(success).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Auto-suggest roles' }),
    ).toBeInTheDocument()
  })

  it('shows the protected-palette message and keeps Apply disabled', () => {
    const protectedPalette: Palette = [
      { id: 'bg', hex: '#ffffff', role: 'background', locked: false },
      { id: 'locked', hex: '#111111', role: 'unset', locked: true },
    ]
    openReview(protectedPalette)
    expect(
      screen.getByText(
        'All colors already have roles or are locked. Set a color to No role or unlock it to include it.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Apply selected' }),
    ).toBeDisabled()
  })

  it('closes a stale snapshot on any palette identity change', () => {
    const { rerender } = openReview()
    rerender(
      <RoleSuggestReview
        palette={reviewPalette.map((swatch) => ({ ...swatch }))}
        onApply={() => true}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Auto-suggest roles' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Role suggestions' }),
    ).not.toBeInTheDocument()
  })

  it('exposes native labeled controls with keyboard focus', () => {
    openReview()
    const checkbox = screen.getByRole('checkbox', { name: /#ffffff/i })
    const select = screen.getByLabelText('Role for #ffffff')
    checkbox.focus()
    expect(checkbox).toHaveFocus()
    select.focus()
    expect(select).toHaveFocus()
  })
})

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
