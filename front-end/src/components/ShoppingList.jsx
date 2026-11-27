import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mealPlanApi, shoppingListApi } from '../services/api'
import { defaultPlanName, formatDateRange } from './mealPlan'
import { creatorName } from './recipeSharing'
import PageTitle from './PageTitle'
import './MealPlan.css'
import './ShoppingList.css'

// "Nov 25, 3:40 PM" for a server time like "2026-11-25T15:40:12" (local time, no zone).
const formatMadeAt = (dateTime) =>
  new Date(dateTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * /meal-plans/:id/shopping-list: the plan's ingredients added up, for anyone in the family to tick off while
 * shopping. Things still to buy come first, then what's in the cart (with who ticked it). The list is made from
 * the plan on request and can be remade after the plan changes; ticks of lines that remain are kept. It reloads
 * when the window gets focus again, so ticks by others show up.
 */
export default function ShoppingList() {
  const { id } = useParams()
  const [plan, setPlan] = useState(null)
  const [list, setList] = useState(undefined)   // undefined while loading, null when there is none yet
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([mealPlanApi.getMealPlan(id), shoppingListApi.getShoppingList(id)]).then(
      ([loadedPlan, loadedList]) => {
        if (cancelled) return
        setPlan(loadedPlan)
        setList(loadedList)
      },
      err => { if (!cancelled) setLoadError(err.message) }
    )
    return () => { cancelled = true }
  }, [id, attempt])

  // Coming back to the tab (e.g. after someone else ticked things): load the latest ticks.
  useEffect(() => {
    const onFocus = () => {
      shoppingListApi.getShoppingList(id).then(setList, () => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [id])

  const retry = () => {
    setLoadError(null)
    setAttempt(n => n + 1)
  }

  const generate = async () => {
    setBusy(true)
    setActionError(null)
    try {
      setList(await shoppingListApi.generateShoppingList(id))
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    setActionError(null)
    try {
      setList(await shoppingListApi.getShoppingList(id))
    } catch (err) {
      setActionError(err.message)
    }
  }

  // Tick at once, then show the server's list (which has everyone's ticks); undo the tick if it fails.
  const toggle = async (item) => {
    const checked = !item.checked
    setActionError(null)
    setList(current => ({
      ...current,
      items: current.items.map(i => (i.id === item.id ? { ...i, checked } : i)),
    }))
    try {
      setList(await shoppingListApi.setItemChecked(id, item.id, checked))
    } catch (err) {
      setList(current => ({
        ...current,
        items: current.items.map(i => (i.id === item.id ? { ...i, checked: item.checked } : i)),
      }))
      setActionError(err.message)
    }
  }

  const back = <Link to={`/meal-plans/${id}`} className="back-button shopping-back">← Back to meal plan</Link>

  if (loadError) {
    return (
      <div className="meal-plan-page shopping-page">
        {back}
        <PageTitle title="Shopping List" />
        <h1>Shopping List</h1>
        <div className="error" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      </div>
    )
  }

  if (list === undefined || !plan) {
    return (
      <div className="meal-plan-page shopping-page">
        {back}
        <PageTitle title="Shopping List" />
        <h1>Shopping List</h1>
        <p>Loading shopping list...</p>
      </div>
    )
  }

  const planName = plan.name || defaultPlanName(plan.startDate, plan.days)
  const toBuy = list?.items.filter(item => !item.checked) ?? []
  const inCart = list?.items.filter(item => item.checked) ?? []

  return (
    <div className="meal-plan-page shopping-page">
      {back}
      <header className="meal-plan-header">
        <PageTitle title="Shopping List" />
        <h1>Shopping List</h1>
        <p className="meal-plan-range">{planName} · {formatDateRange(plan.startDate, plan.days)}</p>
      </header>

      {actionError && <p className="error-message" role="alert">{actionError}</p>}

      {list === null ? (
        <section className="shopping-empty">
          <p>Make a shopping list from this meal plan: the ingredients of its recipes, added up. Everyone in your family can tick things off.</p>
          <button type="button" className="create-recipe-btn" onClick={generate} disabled={busy}>
            {busy ? 'Making list...' : 'Make shopping list'}
          </button>
        </section>
      ) : (
        <>
          <div className="shopping-toolbar">
            <p className="shopping-made">
              Made {creatorName({ createdBy: list.generatedBy }) ? `by ${creatorName({ createdBy: list.generatedBy })} ` : ''}
              on {formatMadeAt(list.generatedAt)} · {inCart.length} of {list.items.length} in the cart
            </p>
            <div className="shopping-actions">
              <button type="button" onClick={refresh}>Refresh</button>
              <button type="button" onClick={generate} disabled={busy}>
                {busy ? 'Updating...' : 'Update from meal plan'}
              </button>
            </div>
          </div>

          {list.planChangedSince && (
            <p className="shopping-notice" role="status">
              The meal plan has changed since this list was made. Use “Update from meal plan” to catch up; ticked items stay ticked.
            </p>
          )}
          {list.leftOutRecipes.length > 0 && (
            <p className="shopping-notice">
              Left out because they are no longer available: {list.leftOutRecipes.join(', ')}.
            </p>
          )}

          {list.items.length === 0 ? (
            <p className="shopping-empty">Nothing to buy: the recipes in this plan have no ingredients.</p>
          ) : (
            <>
              <ItemList title="To buy" items={toBuy} onToggle={toggle} empty="Everything is in the cart." />
              {inCart.length > 0 && <ItemList title="In the cart" items={inCart} onToggle={toggle} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

function ItemList({ title, items, onToggle, empty }) {
  const headingId = `shopping-${title.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section className="shopping-section" aria-labelledby={headingId}>
      <h2 id={headingId}>{title} ({items.length})</h2>
      {items.length === 0 ? (
        <p className="shopping-section-empty">{empty}</p>
      ) : (
        <ul className="shopping-items">
          {items.map(item => (
            <li key={item.id} className={`shopping-item${item.checked ? ' checked' : ''}`}>
              <label>
                <input type="checkbox" checked={item.checked} onChange={() => onToggle(item)} />
                <span className="shopping-item-text">{item.text}</span>
              </label>
              <span className="shopping-item-meta">
                {item.recipes.length > 0 && `for ${item.recipes.join(', ')}`}
                {item.checked && item.checkedBy && ` · ✓ ${item.checkedBy.firstName}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
