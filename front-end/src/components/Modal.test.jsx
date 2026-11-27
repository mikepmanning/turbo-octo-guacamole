import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Modal from './Modal'

const renderModal = (props = {}) => {
  const onClose = vi.fn()
  render(
    <Modal className="box" labelledBy="t" onClose={onClose} {...props}>
      <h2 id="t">Title</h2>
      <button type="button">First</button>
      <button type="button" data-autofocus>Marked</button>
    </Modal>
  )
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Title' }) }
}

// What a browser does when it closes the dialog itself, without a cancel event first.
const closeByBrowser = (dialog) => {
  dialog.removeAttribute('open')
  dialog.dispatchEvent(new Event('close'))
}

describe('Modal', () => {
  it('opens as a modal <dialog> with the content in its box, focusing the marked control', () => {
    const { dialog } = renderModal()

    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveAttribute('open')
    expect(dialog.firstChild).toHaveClass('box')
    expect(screen.getByRole('button', { name: 'Marked' })).toHaveFocus()
  })

  it('tells the parent when the browser closes it', () => {
    const { dialog, onClose } = renderModal()

    closeByBrowser(dialog)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reopens instead when it cannot close now', () => {
    const { dialog, onClose } = renderModal({ closeDisabled: true })

    closeByBrowser(dialog)

    expect(onClose).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute('open')
  })
})
