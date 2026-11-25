import { useId, useRef, useState } from 'react'
import { activeFilters, emptyFilters } from './recipeFilters'
import './RecipeSearch.css'

const PANEL_FIELDS = ['category', 'ingredient', 'maxPrepTimeMinutes', 'maxCookTimeMinutes', 'maxTotalTimeMinutes', 'excludedOnly']

const TIME_FIELDS = [
  { key: 'maxPrepTimeMinutes', label: 'Max prep (min)' },
  { key: 'maxCookTimeMinutes', label: 'Max cook (min)' },
  { key: 'maxTotalTimeMinutes', label: 'Max total (min)' },
]

/**
 * Search box (searches the whole recipe), filters panel, and a chip per filter in use (✕ clears
 * one, "Clear all" clears every one). Filters apply as they change: `onChange` gets the complete
 * new filters.
 * `categories` are suggestions for the category field. `searchInputRef`, if given, is attached
 * to the search box (so the parent can return focus to it).
 */
function RecipeSearch({ filters, onChange, categories = [], searchInputRef: givenSearchInputRef }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const ownSearchInputRef = useRef(null)
  const searchInputRef = givenSearchInputRef ?? ownSearchInputRef
  const panelId = useId()
  const categoryListId = useId()
  const fieldId = useId()

  const chips = activeFilters(filters)
  const panelFiltersInUse = chips.filter(chip => PANEL_FIELDS.includes(chip.key)).length

  const set = (key, value) => onChange({ ...filters, [key]: value })

  // The chip's button disappears with it; keep keyboard focus in the search.
  const clear = (key) => {
    onChange(key ? { ...filters, [key]: '' } : emptyFilters())
    searchInputRef.current?.focus()
  }

  return (
    <form className="recipe-search" role="search" aria-label="Recipe search" onSubmit={(e) => e.preventDefault()}>
      <div className="search-row">
        <input
          type="search"
          ref={searchInputRef}
          className="search-query"
          aria-label="Search recipes"
          placeholder="Search recipes, ingredients, categories..."
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
        />
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onClick={() => setPanelOpen(open => !open)}
        >
          Filters{panelFiltersInUse > 0 && ` (${panelFiltersInUse})`} {panelOpen ? '▴' : '▾'}
        </button>
      </div>

      <div id={panelId} className="filters-panel" hidden={!panelOpen}>
        <div className="filter-field">
          <label htmlFor={`${fieldId}-category`}>Category</label>
          <input
            id={`${fieldId}-category`}
            type="text"
            list={categoryListId}
            placeholder="e.g. Dinner"
            value={filters.category}
            onChange={(e) => set('category', e.target.value)}
          />
          <datalist id={categoryListId}>
            {categories.map(category => <option key={category} value={category} />)}
          </datalist>
        </div>
        <div className="filter-field">
          <label htmlFor={`${fieldId}-ingredient`}>Ingredient</label>
          <input
            id={`${fieldId}-ingredient`}
            type="text"
            placeholder="e.g. garlic"
            value={filters.ingredient}
            onChange={(e) => set('ingredient', e.target.value)}
          />
        </div>
        {TIME_FIELDS.map(({ key, label }) => (
          <div className="filter-field time-field" key={key}>
            <label htmlFor={`${fieldId}-${key}`}>{label}</label>
            <input
              id={`${fieldId}-${key}`}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={filters[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
        <div className="filter-field filter-checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(filters.excludedOnly)}
              onChange={(e) => set('excludedOnly', e.target.checked)}
            />
            Only recipes excluded from meal plans
          </label>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="active-filters">
          <ul className="filter-chips" aria-label="Active filters">
            {chips.map(({ key, label, text }) => (
              <li key={key} className="filter-chip">
                <span>{label}: {text}</span>
                <button type="button" aria-label={`Remove ${label} filter`} onClick={() => clear(key)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="clear-filters" onClick={() => clear()}>
            Clear all
          </button>
        </div>
      )}
    </form>
  )
}

export default RecipeSearch
