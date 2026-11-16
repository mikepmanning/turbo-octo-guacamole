/**
 * The bar shown while selecting recipes on the list: how many are selected, Select all /
 * Clear, and the Cancel and Delete actions. It sticks to the top of the screen while scrolling.
 */
function SelectionBar({ selectedCount, totalCount, onSelectAll, onClear, onCancel, onDelete, deleteButtonRef }) {
  return (
    <div className="selection-bar">
      <span className="selection-count" aria-live="polite">{selectedCount} selected</span>
      <button type="button" className="link-btn" onClick={onSelectAll} disabled={selectedCount === totalCount}>
        Select all
      </button>
      <button type="button" className="link-btn" onClick={onClear} disabled={selectedCount === 0}>
        Clear
      </button>
      <span className="selection-bar-spacer" />
      <button type="button" className="selection-cancel" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className="selection-delete"
        ref={deleteButtonRef}
        onClick={onDelete}
        disabled={selectedCount === 0}
      >
        Delete ({selectedCount})
      </button>
    </div>
  )
}

export default SelectionBar
