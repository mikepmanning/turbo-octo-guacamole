import { useEffect, useId } from 'react'
import './ConfirmDialog.css'

/**
 * A modal "are you sure?" for destructive actions. Focus starts on Cancel, the safe choice;
 * Escape or a click outside the dialog also cancels. While `busy`, nothing can be clicked
 * and the confirm button shows `busyLabel`. `error` is shown inside the dialog.
 * `children` (e.g. a list of what will be affected) appear below the message.
 */
function ConfirmDialog({
  title, message, confirmLabel, busyLabel, busy = false, error, onConfirm, onCancel, children,
}) {
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        {children}
        {error && <p className="confirm-error" role="alert">{error}</p>}
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </button>
          <button type="button" className="confirm-danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
