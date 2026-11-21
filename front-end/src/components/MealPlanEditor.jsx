import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { recipeApi } from '../services/api'
import MealPlanGrid from './MealPlanGrid'
import RecipePickerDialog from './RecipePickerDialog'
import ConfirmDialog from './ConfirmDialog'
import {
  defaultPlanName, filledSlotCount, isDateString, moveToStartDate, formatDateRange, formatDay, formatLongDay, formatShortDate, formatShortRange,
  mealCount, mealLabel, pickRandomRecipe, recipeMeta, recipesForMeal, requestsUsedBy, setSlot, slotKey, toPayload,
  ingredientChecklist,
} from './mealPlan'
import './RecipeList.css'
import './MealPlan.css'

const planContents = (plan) => JSON.stringify({ name: plan.name ?? '', startDate: plan.startDate, slots: plan.slots })

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

// "Uses chicken" for each use-up ingredient the recipe provides for this meal (each text once).
function UsesBadges({ plan, recipe, mealType }) {
  const texts = [...new Set(requestsUsedBy(plan, recipe, mealType).map(request => request.text))]
  return texts.map(text => <p key={text} className="uses-ingredient">Uses {text}</p>)
}

/**
 * Edits a meal plan's name and meals, shared by a new plan (NewMealPlan) and a saved one (MealPlanView).
 * Each slot can be swapped for a random recipe, chosen in a picker, or removed; empty slots can be
 * filled again. Loads the recipes it swaps and chooses from.
 *
 * - initialPlan: the draft to edit (see mealPlan.js); read once on mount.
 * - onSave(payload): saves the POST/PUT body; if it throws, its message is shown and the user can try again.
 * - onCancel(): called by Cancel (and the back link, if `backLabel` is given), after asking when
 *   `discard.when` is 'always', or 'changed' and something was changed.
 * - discard: { when, title, message, confirmLabel } for the "discard?" dialog.
 * - onChange(plan): optional, called with every edit.
 * - knownRecipes: optional summaries ({ id, title, ... }) of recipes that may no longer be in the
 *   collection, e.g. a saved plan's, so a deleted recipe still shows its title.
 */
function MealPlanEditor({
  initialPlan,
  title,
  backLabel,
  saveLabel,
  savingLabel = 'Saving...',
  discard,
  onSave,
  onCancel,
  onChange,
  knownRecipes = [],
}) {
  const [initialContents] = useState(() => planContents(initialPlan))
  const [plan, setPlan] = useState(initialPlan)
  // The start date field's text, exactly as the browser reports it while typing (see changeStartDate).
  const [startInput, setStartInput] = useState(initialPlan.startDate)

  // The recipes, tagged with the load attempt they answer: until it matches, they are loading.
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loaded, setLoaded] = useState({ attempt: null, recipes: [], error: null })
  const loading = loaded.attempt !== loadAttempt
  const { recipes, error: loadError } = loaded

  const [picking, setPicking] = useState(null)   // slot key the picker is open for
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const cancelOpenerRef = useRef(null)   // the button that opened the "discard?" dialog
  const saveErrorRef = useRef(null)

  // The recipes to show in the slots and to swap or choose from.
  useEffect(() => {
    let ignore = false
    recipeApi.getAllRecipes()
      .then(data => { if (!ignore) setLoaded({ attempt: loadAttempt, recipes: data, error: null }) })
      .catch(err => { if (!ignore) setLoaded({ attempt: loadAttempt, recipes: [], error: err.message }) })
    return () => { ignore = true }
  }, [loadAttempt])

  // Save is at the bottom of a long page and the error at the top: bring it into view.
  useEffect(() => {
    if (saveError) saveErrorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [saveError])

  const recipesById = useMemo(() => new Map(recipes.map(recipe => [recipe.id, recipe])), [recipes])
  const knownById = useMemo(() => new Map(knownRecipes.map(recipe => [recipe.id, recipe])), [knownRecipes])
  // From "Avoid recent recipes": when each recipe was last planned before this plan.
  const lastPlanned = plan.avoid?.lastPlanned ?? {}

  const updatePlan = (next, message) => {
    setPlan(next)
    onChange?.(next)
    if (message) setAnnouncement(message)
  }

  const describeSlot = (key) => {
    const [date, mealType] = key.split('|')
    return { day: formatDay(date), longDay: formatLongDay(date), meal: mealLabel(mealType), mealType }
  }

  const titleOf = (id) => recipesById.get(id)?.title ?? 'a recipe'

  const randomize = (key) => {
    const id = pickRandomRecipe(plan, key, recipes)
    const { day, meal } = describeSlot(key)
    updatePlan(setSlot(plan, key, id), `${day} ${meal}: ${titleOf(id)}`)
  }

  const remove = (key) => {
    const { day, meal } = describeSlot(key)
    updatePlan(setSlot(plan, key, null), `Removed ${meal} on ${day}`)
  }

  // While a date is typed, the field reports '' or partial dates. Keep its text as reported (writing
  // a different value back would disrupt the typing) and move the plan whenever it is a complete date.
  const changeStartDate = (value) => {
    setStartInput(value)
    if (!isDateString(value) || value === plan.startDate) return
    const moved = moveToStartDate(plan, value)
    updatePlan(moved, `Plan moved to ${formatDateRange(moved.startDate, moved.days)}`)
  }

  const pick = (id) => {
    const { day, meal } = describeSlot(picking)
    updatePlan(setSlot(plan, picking, id), `${day} ${meal}: ${titleOf(id)}`)
    setPicking(null)
  }

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(toPayload(plan))
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const askToCancel = (e) => {
    const changed = planContents(plan) !== initialContents
    if (discard.when === 'always' || changed) {
      cancelOpenerRef.current = e.currentTarget
      setConfirmingCancel(true)
    } else {
      onCancel()
    }
  }

  const closeConfirmCancel = () => {
    setConfirmingCancel(false)
    cancelOpenerRef.current?.focus()
  }

  const renderSlot = (date, mealType) => {
    const key = slotKey(date, mealType)
    const id = plan.slots[key] ?? null
    const { longDay, meal } = describeSlot(key)
    const mealName = meal.toLowerCase()
    const canRandomize = recipesForMeal(recipes, mealType).some(recipe => recipe.id !== id)
    const chooseButton = (
      <button type="button" className="slot-button" onClick={() => setPicking(key)}
        aria-label={`Choose ${mealName} for ${longDay}`}>
        Choose…
      </button>
    )

    if (id === null) {
      return (
        <div className="meal-slot empty">
          <p className="slot-empty">No meal</p>
          <div className="slot-actions">
            <button type="button" className="slot-button" onClick={() => randomize(key)} disabled={!canRandomize}
              aria-label={`Add a random ${mealName} on ${longDay}`}>
              🔀 Random
            </button>
            {chooseButton}
          </div>
        </div>
      )
    }

    const recipe = recipesById.get(id)
    const known = knownById.get(id)
    const alsoPlanned = lastPlanned[id]
    return (
      <div className="meal-slot">
        {recipe
          ? (
            <>
              {/* New tab, so the unsaved changes stay open here */}
              <Link to={`/recipe/${id}`} target="_blank" rel="noopener noreferrer" className="slot-title">
                {recipe.title}
              </Link>
              <p className="slot-meta">{recipeMeta(recipe)}</p>
              <UsesBadges plan={plan} recipe={recipe} mealType={mealType} />
              {recipe.excludedFromMealPlans && <p className="excluded-tag">Excluded from meal plans</p>}
              {alsoPlanned && <p className="also-planned">Also planned {formatShortDate(alsoPlanned)}</p>}
            </>
          )
          : (
            <p className="slot-missing">
              {known ? `${known.title} (no longer available)` : 'Recipe no longer available'}
            </p>
          )}
        <div className="slot-actions">
          <button type="button" className="slot-button" onClick={() => randomize(key)} disabled={!canRandomize}
            aria-label={`Swap ${mealName} on ${longDay}`}>
            🔀 Swap
          </button>
          {chooseButton}
          <button type="button" className="slot-button slot-remove" onClick={() => remove(key)}
            aria-label={`Remove ${mealName} on ${longDay}`}>
            ✕
          </button>
        </div>
      </div>
    )
  }

  const range = formatDateRange(plan.startDate, plan.days)
  const nothingPlanned = filledSlotCount(plan) === 0
  const pickingSlot = picking && describeSlot(picking)

  return (
    <>
      {backLabel && (
        <div className="meal-plan-top">
          <button type="button" className="back-link" onClick={askToCancel}>{backLabel}</button>
        </div>
      )}

      <header className="meal-plan-header">
        <h1>{title}</h1>
        <p className="meal-plan-range">{range}</p>
        {plan.avoid && (
          <p className="meal-plan-avoiding">
            Avoiding recipes planned {formatShortRange(plan.avoid.from, plan.avoid.to)}
          </p>
        )}
        {plan.useUp?.length > 0 && !loading && !loadError && (
          <ul className="use-up-checklist" aria-label="Ingredients to use up">
            {ingredientChecklist(plan, recipesById).map(({ request, met }, index) => {
              const done = met >= request.count
              return (
                <li key={index} className={done ? 'met' : undefined}>
                  {capitalize(request.text)}: {Math.min(met, request.count)} of {mealCount(request.mealType, request.count)}
                  {done && ' ✓'}
                </li>
              )
            })}
          </ul>
        )}
        <div className="plan-fields">
          <label className="plan-name">
            Plan name
            <input
              type="text"
              value={plan.name ?? ''}
              maxLength={100}
              placeholder={defaultPlanName(plan.startDate, plan.days)}
              onChange={(e) => updatePlan({ ...plan, name: e.target.value })}
            />
          </label>
          {/* Moves the whole plan: each day's meals keep their day. */}
          <label className="plan-name plan-start">
            Start date
            <input
              type="date"
              required
              value={startInput}
              onChange={(e) => changeStartDate(e.target.value)}
              onBlur={() => setStartInput(plan.startDate)}
            />
          </label>
        </div>
      </header>

      {saveError && (
        <div className="error" ref={saveErrorRef}>
          <p>Error: {saveError}</p>
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">{announcement}</p>

      {loading && <p>Loading recipes...</p>}

      {!loading && loadError && (
        <div className="error">
          <p>Error: {loadError}</p>
          <button type="button" onClick={() => setLoadAttempt(n => n + 1)}>Retry</button>
        </div>
      )}

      {!loading && !loadError && (
        <MealPlanGrid
          caption={`Meal plan for ${range}`}
          startDate={plan.startDate}
          days={plan.days}
          mealTypes={plan.mealTypes}
          renderSlot={renderSlot}
        />
      )}

      <div className="meal-plan-actions">
        {nothingPlanned && !loading && <p className="meal-plan-hint">Add at least one meal to save the plan.</p>}
        <button type="button" className="selection-cancel" onClick={askToCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="create-recipe-btn save-plan"
          onClick={save}
          disabled={saving || loading || Boolean(loadError) || nothingPlanned}
        >
          {saving ? savingLabel : saveLabel}
        </button>
      </div>

      {picking && (
        <RecipePickerDialog
          title={`Choose ${pickingSlot.meal.toLowerCase()} for ${pickingSlot.day}`}
          mealType={pickingSlot.mealType}
          recipes={recipes}
          currentId={plan.slots[picking]}
          lastPlanned={lastPlanned}
          useUp={(plan.useUp ?? []).filter(request => request.mealType === pickingSlot.mealType)}
          onPick={pick}
          onCancel={() => setPicking(null)}
        />
      )}

      {confirmingCancel && (
        <ConfirmDialog
          title={discard.title}
          message={discard.message}
          confirmLabel={discard.confirmLabel}
          busyLabel={discard.confirmLabel}
          onConfirm={onCancel}
          onCancel={closeConfirmCancel}
        />
      )}
    </>
  )
}

export default MealPlanEditor
