import { useEffect, useLayoutEffect, useRef } from 'react'
import './Modal.css'

/**
 * A modal dialog on the native <dialog> element, opened with showModal(): the browser keeps Tab inside it,
 * makes the page behind inert and dims it (::backdrop in index.css), and focuses the first control
 * (or the one marked `autoFocus`). Escape or a click outside calls `onClose`, unless `closeDisabled`
 * (e.g. while saving). Focus goes back to whatever had it before the dialog opened.
 *
 * Render it only while it should be open; the content goes in a <div className={className}>, which is
 * the visible box.
 */
function Modal({ className, role, labelledBy, describedBy, closeDisabled = false, onClose, children }) {
  const dialogRef = useRef(null)
  const closeRef = useRef({ onClose, closeDisabled })
  useLayoutEffect(() => {
    closeRef.current = { onClose, closeDisabled }
  })

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    if (!dialog.open) dialog.showModal()
    dialog.querySelector('[data-autofocus]')?.focus()
    return () => {
      if (dialog.open) dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  const requestClose = () => {
    if (!closeRef.current.closeDisabled) closeRef.current.onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Escape: the app decides (the dialog stays open while busy, and the parent unmounts it).
      onCancel={(e) => {
        e.preventDefault()
        requestClose()
      }}
      // A click on the <dialog> itself, not its box, is a click on the dimmed area around the box.
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      // The browser may close it without a cancel event (Chrome does on a repeated Escape): reopen it if
      // it can't close now, otherwise tell the parent. (Closing on unmount fires after React has let go.)
      onClose={() => {
        const dialog = dialogRef.current
        if (!dialog || dialog.open) return
        if (closeRef.current.closeDisabled) dialog.showModal()
        else closeRef.current.onClose()
      }}
    >
      <div className={className}>{children}</div>
    </dialog>
  )
}

export default Modal
