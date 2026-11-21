/**
 * The bar shown while selecting recipes on the list: how many are selected, Select all /
 * Clear, and the actions: exclude from or include in meal plans, Cancel, and Delete. It sticks
 * to the top of the screen while scrolling. `busy` disables the meal plan actions while saving.
 */
function SelectionBar({
  selectedCount, totalCount, onSelectAll, onClear, onCancel, onDelete, deleteButtonRef,
  onExclude, onInclude, busy = false,
}) {
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
      <button type="button" className="selection-meal-plans" onClick={onExclude} disabled={selectedCount === 0 || busy}>
        Exclude from meal plans
      </button>
      <button type="button" className="selection-meal-plans" onClick={onInclude} disabled={selectedCount === 0 || busy}>
        Include in meal plans
      </button>
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
