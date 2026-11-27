import { useId, useMemo, useState } from 'react'
import Modal from './Modal'
import { emptyFilters, filterRecipes } from './recipeFilters'
import { formatShortDate, mealLabel, recipeMeta, recipesForMeal, usesIngredient } from './mealPlan'
import './ConfirmDialog.css'
import './MealPlan.css'

const byTitle = (a, b) => a.title.localeCompare(b.title)

/**
 * Picks a recipe for one meal of a plan. Lists the recipes in the meal's category, with a
 * search box (the same matching as the recipe list search) and "Show all recipes" for
 * anything else, including recipes excluded from meal plans (marked, but still choosable). Escape or a click outside cancels. `lastPlanned` ({ [recipeId]: date }) marks
 * recipes planned recently ("Also planned Nov 25"); they can still be chosen. `useUp` requests for
 * this meal mark the recipes that use their ingredient ("Uses chicken").
 */
function RecipePickerDialog({ title, mealType, recipes, currentId, lastPlanned = {}, useUp = [], onPick, onCancel }) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const pool = useMemo(
    () => (showAll ? recipes : recipesForMeal(recipes, mealType)),
    [showAll, recipes, mealType],
  )
  const shown = useMemo(
    () => filterRecipes(pool, { ...emptyFilters(), query }).sort(byTitle),
    [pool, query],
  )

  let emptyMessage = null
  if (pool.length === 0) emptyMessage = `No recipes have the “${mealLabel(mealType)}” category yet. Show all recipes to choose any recipe.`
  else if (shown.length === 0) emptyMessage = 'No recipes match your search.'

  return (
    <Modal className="picker-dialog" labelledBy={titleId} onClose={onCancel}>
      <h2 id={titleId}>{title}</h2>
      <div className="picker-controls">
        <input
          type="search"
          className="picker-search"
          aria-label="Search recipes"
          placeholder="Search recipes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-autofocus
        />
        <label className="picker-show-all">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show all recipes
        </label>
      </div>

      {emptyMessage
        ? <p className="picker-empty" role="status">{emptyMessage}</p>
        : (
          <ul className="picker-list">
            {shown.map(recipe => {
              const current = recipe.id === currentId
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    className={current ? 'picker-option current' : 'picker-option'}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onPick(recipe.id)}
                  >
                    <span className="picker-title">{recipe.title}</span>
                    <span className="picker-meta">{recipeMeta(recipe)}</span>
                    {[...new Set(useUp.filter(request => usesIngredient(recipe, request)).map(r => r.text))].map(text => (
                      <span key={text} className="uses-ingredient">Uses {text}</span>
                    ))}
                    {recipe.excludedFromMealPlans && <span className="excluded-tag">Excluded from meal plans</span>}
                    {lastPlanned[recipe.id] && (
                      <span className="also-planned">Also planned {formatShortDate(lastPlanned[recipe.id])}</span>
                    )}
                    {current && <span className="picker-current">Current</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

      <div className="confirm-actions">
        <button type="button" className="confirm-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  )
}

export default RecipePickerDialog
