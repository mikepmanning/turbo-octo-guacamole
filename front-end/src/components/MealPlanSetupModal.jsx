import { useEffect, useId, useMemo, useState } from 'react'
import { mealPlanApi } from '../services/api'
import {
  AVOID_PERIODS, MAX_DAYS, MAX_USE_UP, MEAL_TYPES, avoidWindow, formatDateRange, formatShortRange, generatePlan,
  excludedForMeal, ingredientMatches, isDateString, joinNames, lastPlannedByRecipe, mealCount, mealLabel, mealPlural, orderMealTypes,
  plannedInPlans, recipesForMeal, recipesUsing, shortfalls, todayString,
} from './mealPlan'
import Modal from './Modal'
import './RecipeList.css'
import './MealPlan.css'

const DEFAULT_MEALS = ['BREAKFAST', 'LUNCH', 'DINNER']

const recipeCount = (n) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`

// "Avoid recent recipes" is remembered in this browser.
const AVOID_STORAGE_KEY = 'recipehome.mealPlan.avoidDays'

const rememberedAvoidDays = () => {
  try {
    const days = Number(window.localStorage.getItem(AVOID_STORAGE_KEY))
    return AVOID_PERIODS.some(period => period.days === days) ? days : 0
  } catch {
    return 0   // storage unavailable (e.g. blocked): just don't avoid
  }
}

const rememberAvoidDays = (days) => {
  try {
    window.localStorage.setItem(AVOID_STORAGE_KEY, String(days))
  } catch {
    // Not remembering the choice is fine.
  }
}

/**
 * "Plan Meals" dialog on the meal plans page: which meals, how many days, the start date, whether
 * to avoid recipes planned in the weeks before (checked with GET /api/meal-plans/meals), and
 * ingredients to use up (e.g. chicken for 2 dinners).
 * Generate fills the plan with random recipes from `recipes` and passes it to `onGenerate`;
 * nothing is saved yet. Mount it only while open, so it starts fresh each time.
 *
 * `recipes` is null while they are still loading (the dialog says so); with `loadError`, it shows
 * the error and a Retry that calls `onRetry`.
 */
function MealPlanSetupModal({ recipes, loadError, onRetry, onClose, onGenerate }) {
  const titleId = useId()

  let body
  if (loadError) {
    body = (
      <>
        <p className="error-message" role="alert">Could not load recipes: {loadError}</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-action" onClick={onRetry}>Retry</button>
        </div>
      </>
    )
  } else if (recipes === null) {
    body = (
      <>
        <p role="status">Loading recipes...</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </>
    )
  } else {
    // Mounted once the recipes are here, so its defaults are worked out from them.
    body = <SetupForm recipes={recipes} onClose={onClose} onGenerate={onGenerate} />
  }

  return (
    <Modal className="modal-content meal-plan-setup" labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId}>Plan Meals</h2>
      {body}
    </Modal>
  )
}

function SetupForm({ recipes, onClose, onGenerate }) {
  const daysId = useId()
  const startDateId = useId()
  const avoidId = useId()

  // How many recipes each meal can draw from; a meal with none can't be chosen.
  const counts = useMemo(
    () => Object.fromEntries(MEAL_TYPES.map(({ value }) => [value, recipesForMeal(recipes, value).length])),
    [recipes],
  )
  const [selected, setSelected] = useState(() => new Set(DEFAULT_MEALS.filter(meal => counts[meal] > 0)))
  const [days, setDays] = useState(String(MAX_DAYS))
  const [startDate, setStartDate] = useState(todayString)

  const toggle = (meal) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(meal)) next.delete(meal)
      else next.add(meal)
      return next
    })
  }

  const validDate = isDateString(startDate)

  // "Avoid recent recipes": the meals planned in the period before the start date. The result is
  // tagged with the request it answers; until it matches, the check is in progress.
  const [avoidDays, setAvoidDays] = useState(rememberedAvoidDays)
  const [checkAttempt, setCheckAttempt] = useState(0)
  const [planned, setPlanned] = useState({ request: null, meals: [], error: null })
  const period = avoidDays > 0 && validDate ? avoidWindow(startDate, avoidDays) : null
  const request = period && `${period.from}|${period.to}|${checkAttempt}`

  useEffect(() => {
    if (!request) return
    const [from, to] = request.split('|')
    let ignore = false
    mealPlanApi.getPlannedMeals(from, to)
      .then(meals => { if (!ignore) setPlanned({ request, meals, error: null }) })
      .catch(err => { if (!ignore) setPlanned({ request, meals: [], error: err.message }) })
    return () => { ignore = true }
  }, [request])

  const checking = Boolean(period) && planned.request !== request
  const checkError = period && !checking ? planned.error : null
  const recentMeals = period && !checking && !checkError ? planned.meals : []
  const lastPlanned = lastPlannedByRecipe(recentMeals)

  const changeAvoidDays = (value) => {
    setAvoidDays(value)
    setCheckAttempt(n => n + 1)   // a fresh check, not an earlier result for the same period
    rememberAvoidDays(value)
  }

  // "Use up ingredients" rows. A row's meal and count follow the meals and days chosen above
  // (e.g. fewer days caps the count), so the effective values are worked out when used.
  const chosenMeals = orderMealTypes([...selected])
  const [useUpRows, setUseUpRows] = useState([])
  const [nextRowKey, setNextRowKey] = useState(1)
  const effectiveRow = (row) => ({
    text: row.text,
    mealType: chosenMeals.includes(row.mealType) ? row.mealType : chosenMeals[0],
    count: Math.min(row.count, Number(days)),
    excluded: row.excluded,
  })

  const addUseUpRow = () => {
    const mealType = chosenMeals.includes('DINNER') ? 'DINNER' : chosenMeals[0]
    setUseUpRows(rows => [...rows, { key: nextRowKey, text: '', count: 1, mealType, excluded: [] }])
    setNextRowKey(n => n + 1)
  }
  const changeUseUpRow = (key, changes) =>
    setUseUpRows(rows => rows.map(row => (row.key === key ? { ...row, ...changes } : row)))
  const removeUseUpRow = (key) => setUseUpRows(rows => rows.filter(row => row.key !== key))

  const canGenerate = selected.size > 0 && validDate && !checking && !checkError
  const totalMeals = selected.size * Number(days)

  let summary
  if (selected.size === 0) summary = 'Choose at least one meal.'
  else if (!validDate) summary = 'Choose a start date.'
  else summary = `${formatDateRange(startDate, Number(days))} · ${totalMeals} ${totalMeals === 1 ? 'meal' : 'meals'}`

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canGenerate) return
    const avoid = period ? { from: period.from, to: period.to, lastPlanned } : null
    const useUp = useUpRows.map(effectiveRow)
    onGenerate(generatePlan({ recipes, mealTypes: [...selected], startDate, days: Number(days), avoid, useUp }))
  }

  const firstEnabled = MEAL_TYPES.find(({ value }) => counts[value] > 0)?.value
  const excludedTotal = recipes.filter(recipe => recipe.excludedFromMealPlans).length

  return (
    <form onSubmit={handleSubmit}>
      <fieldset className="meal-choices">
        <legend>Meals</legend>
        {MEAL_TYPES.map(({ value, label }) => {
          const count = counts[value]
          return (
            <label key={value} className={count === 0 ? 'meal-choice unavailable' : 'meal-choice'}>
              <input
                type="checkbox"
                checked={selected.has(value)}
                disabled={count === 0}
                onChange={() => toggle(value)}
                autoFocus={value === firstEnabled}
              />
              {label} <span className="meal-count">({recipeCount(count)})</span>
              {count === 0 && (
                <span className="meal-hint">
                  {excludedForMeal(recipes, value).length > 0
                    ? `All ${label} recipes are excluded from meal plans`
                    : `Add a recipe with the “${label}” category first`}
                </span>
              )}
            </label>
          )
        })}
        {excludedTotal > 0 && (
          <p className="excluded-note">
            {recipeCount(excludedTotal)} {excludedTotal === 1 ? 'is' : 'are'} excluded from meal plans.
          </p>
        )}
      </fieldset>

      <div className="setup-field">
        <label htmlFor={daysId}>Number of days</label>
        <select id={daysId} value={days} onChange={(e) => setDays(e.target.value)}>
          {Array.from({ length: MAX_DAYS }, (_, i) => String(i + 1)).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="setup-field">
        <label htmlFor={startDateId}>Start date</label>
        <input
          id={startDateId}
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="setup-field">
        <label htmlFor={avoidId}>Avoid recent recipes</label>
        <select id={avoidId} value={avoidDays} onChange={(e) => changeAvoidDays(Number(e.target.value))}>
          {AVOID_PERIODS.map(({ days: value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {period && (
        <div className="avoid-summary" aria-live="polite">
          {checking && <p>Checking earlier meal plans…</p>}
          {checkError && (
            <>
              <p className="error-message" role="alert">Couldn't check earlier meal plans: {checkError}</p>
              <button type="button" className="link-btn" onClick={() => setCheckAttempt(n => n + 1)}>Retry</button>
            </>
          )}
          {!checking && !checkError && (
            <AvoidSummary
              range={formatShortRange(period.from, period.to)}
              meals={recentMeals}
              lastPlanned={lastPlanned}
              warnings={shortfalls({ recipes, mealTypes: [...selected], days: Number(days), lastPlanned })}
              days={Number(days)}
            />
          )}
        </div>
      )}

      {chosenMeals.length > 0 && (
        <fieldset className="use-up">
          <legend>Use up ingredients (optional)</legend>
          {useUpRows.map((row, index) => (
            <UseUpRow
              key={row.key}
              number={index + 1}
              row={row}
              request={effectiveRow(row)}
              recipes={recipes}
              mealTypes={chosenMeals}
              days={Number(days)}
              onChange={(changes) => changeUseUpRow(row.key, changes)}
              onRemove={() => removeUseUpRow(row.key)}
            />
          ))}
          {useUpRows.length < MAX_USE_UP && (
            <button type="button" className="link-btn" onClick={addUseUpRow}>+ Add an ingredient</button>
          )}
        </fieldset>
      )}

      <p className="plan-summary" aria-live="polite">{summary}</p>

      <div className="modal-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" className="primary-action" disabled={!canGenerate}>Generate</button>
      </div>
    </form>
  )
}

// One "Use up ingredients" row: the ingredient, how many meals, which meal; then the ingredient names
// it matches (untick the ones you don't mean) and how many of that meal's recipes use it.
function UseUpRow({ number, row, request, recipes, mealTypes, days, onChange, onRemove }) {
  const { text, mealType, count } = request
  const searching = text.trim() !== ''
  const matches = searching ? ingredientMatches(recipesForMeal(recipes, mealType), text) : []
  const using = searching ? recipesUsing(recipes, request).length : 0
  const name = `“${text.trim()}”`
  const uses = using === 1 ? 'uses' : 'use'

  let status = null
  if (searching && using === 0) status = `⚠ No ${mealPlural(mealType)} use ${name}`
  else if (searching && using < count) status = `⚠ Only ${mealCount(mealType, using)} ${uses} ${name}, so ${using} of ${count} meals`
  else if (searching) status = `✓ ${mealCount(mealType, using)} ${uses} it`

  const toggleExcluded = (ingredient) => onChange({
    excluded: row.excluded.includes(ingredient)
      ? row.excluded.filter(n => n !== ingredient)
      : [...row.excluded, ingredient],
  })

  return (
    <div className="use-up-row">
      <div className="use-up-fields">
        <input
          type="text"
          aria-label={`Ingredient ${number}`}
          placeholder="e.g. chicken"
          value={row.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        <span>in</span>
        <select aria-label={`How many meals for ingredient ${number}`} value={count}
          onChange={(e) => onChange({ count: Number(e.target.value) })}>
          {Array.from({ length: days }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select aria-label={`Meal for ingredient ${number}`} value={mealType}
          onChange={(e) => onChange({ mealType: e.target.value })}>
          {mealTypes.map(value => <option key={value} value={value}>{mealLabel(value)}</option>)}
        </select>
        <button type="button" className="link-btn" aria-label={`Remove ingredient ${number}`} onClick={onRemove}>✕</button>
      </div>
      {matches.length > 0 && (
        <fieldset className="use-up-matches">
          <legend>Matches</legend>
          {matches.map(match => (
            <label key={match.name}>
              <input
                type="checkbox"
                checked={!row.excluded.includes(match.name)}
                onChange={() => toggleExcluded(match.name)}
              />
              {match.name} <span className="meal-count">({match.count})</span>
            </label>
          ))}
        </fieldset>
      )}
      {status && (
        <p className={status.startsWith('⚠') ? 'use-up-status avoid-warning' : 'use-up-status'} aria-live="polite">
          {status}
        </p>
      )}
    </div>
  )
}

// What "Avoid recent recipes" will avoid, and the meals that will still need some of those recipes.
function AvoidSummary({ range, meals, lastPlanned, warnings, days }) {
  if (meals.length === 0) return <p>Nothing planned {range}.</p>
  const avoided = Object.keys(lastPlanned).length
  return (
    <>
      <p>{range}: {recipeCount(avoided)} to avoid, from {joinNames(plannedInPlans(meals))}</p>
      {warnings.map(({ mealType, fresh, reused }) => (
        <p key={mealType} className="avoid-warning">
          ⚠ {mealLabel(mealType)}: {fresh} new {fresh === 1 ? 'recipe' : 'recipes'} for {days} {days === 1 ? 'day' : 'days'},
          so {reused} will be reused from that period
        </p>
      ))}
    </>
  )
}

export default MealPlanSetupModal
