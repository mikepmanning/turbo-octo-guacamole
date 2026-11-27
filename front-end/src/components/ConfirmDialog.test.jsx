import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from './ConfirmDialog'

function renderDialog(props = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const { unmount } = render(
    <ConfirmDialog
      title="Delete this recipe?"
      message="“Toast” will be removed from your recipes."
      confirmLabel="Delete"
      busyLabel="Deleting..."
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  )
  return { user: userEvent.setup(), onConfirm, onCancel, unmount }
}

describe('ConfirmDialog', () => {
  it('is an alert dialog named by its title and described by its message', () => {
    renderDialog()

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this recipe?' })
    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveAttribute('open')   // opened with showModal(): modal, page behind inert
    expect(dialog).toHaveAccessibleDescription('“Toast” will be removed from your recipes.')
  })

  it('gives focus back to what had it when it closes', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = renderDialog()
    expect(opener).not.toHaveFocus()

    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('starts with focus on Cancel, the safe choice', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('confirms only from the confirm button', async () => {
    const { user, onConfirm, onCancel } = renderDialog()

    await user.click(screen.getByRole('heading', { name: 'Delete this recipe?' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the Cancel button', (user) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', (user) => user.keyboard('{Escape}')],
    ['a click outside the dialog', (user) => user.click(document.querySelector('dialog'))],
  ])('cancels with %s', async (_, action) => {
    const { user, onConfirm, onCancel } = renderDialog()

    await action(user)

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('while busy, shows the busy label and ignores every way out', async () => {
    const { user, onConfirm, onCancel } = renderDialog({ busy: true })

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('dialog'))

    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shows extra content below the message', () => {
    renderDialog({ children: <ul><li>Toast</li><li>Jam</li></ul> })

    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Toast', 'Jam'])
  })

  it('shows an error inside the dialog', () => {
    renderDialog({ error: 'Failed to delete recipe' })

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete recipe')
  })
})
