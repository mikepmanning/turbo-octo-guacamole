// Runs before every test file (see `test.setupFiles` in vite.config.js).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom has <dialog> but not showModal()/close() or the Escape key's "cancel" event, which Modal
// relies on. This stand-in does what a browser does: open/close set the `open` attribute, close fires
// "close", and Escape fires a cancelable "cancel" at the topmost modal dialog (closing it unless prevented).
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  const openModals = []
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
    openModals.push(this)
  }
  HTMLDialogElement.prototype.close = function close() {
    const index = openModals.indexOf(this)
    if (index >= 0) openModals.splice(index, 1)
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  document.addEventListener('keydown', (e) => {
    const top = openModals.filter(dialog => dialog.isConnected).at(-1)
    if (e.key !== 'Escape' || !top) return
    if (top.dispatchEvent(new Event('cancel', { cancelable: true }))) top.close()
  })
}
