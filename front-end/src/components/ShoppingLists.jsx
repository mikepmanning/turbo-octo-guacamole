import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shoppingListApi } from '../services/api'
import { defaultPlanName, formatDateRange, planStatus, todayString } from './mealPlan'
import PageTitle from './PageTitle'
import './MealPlan.css'
import './ShoppingList.css'

// Most useful first: lists for plans happening now, then upcoming ones (soonest first), then past ones
// (latest first, as the server sends them).
const RANK = { Current: 0, Upcoming: 1, Past: 2 }
const orderLists = (lists, today) => [...lists].sort((a, b) => {
  const byStatus = RANK[planStatus(a.startDate, a.endDate, today)] - RANK[planStatus(b.startDate, b.endDate, today)]
  if (byStatus !== 0) return byStatus
  if (planStatus(a.startDate, a.endDate, today) === 'Upcoming') return a.startDate.localeCompare(b.startDate)
  return 0
})

/**
 * /shopping-lists (from the front page): every shopping list of the user's and their family's meal plans, each
 * opening its list. Lists are made from a meal plan's "Shopping List" page.
 */
export default function ShoppingLists() {
  const [lists, setLists] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    shoppingListApi.getShoppingLists().then(
      loaded => { if (!cancelled) setLists(loaded) },
      err => { if (!cancelled) setError(err.message) }
    )
    return () => { cancelled = true }
  }, [attempt])

  const retry = () => {
    setError(null)
    setAttempt(n => n + 1)
  }

  const today = todayString()

  return (
    <div className="meal-plan-page shopping-page">
      <div className="meal-plan-top">
        <Link to="/" className="back-link">← Back to Recipes</Link>
      </div>

      <header className="meal-plan-header">
        <PageTitle title="Shopping Lists" />
        <h1>Shopping Lists</h1>
        <p className="meal-plan-range">Your family's shopping lists, current and upcoming first.</p>
      </header>

      {error ? (
        <div className="error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      ) : lists === null ? (
        <p>Loading shopping lists...</p>
      ) : lists.length === 0 ? (
        <div className="meal-plans-empty">
          <p>
            No shopping lists yet. Open a <Link to="/meal-plans">meal plan</Link> and choose “Shopping List” to make one.
          </p>
        </div>
      ) : (
        <ul className="meal-plan-cards">
          {orderLists(lists, today).map(list => {
            const status = planStatus(list.startDate, list.endDate, today)
            const done = list.itemCount > 0 && list.checkedCount === list.itemCount
            return (
              <li key={list.mealPlanId}>
                <Link to={`/meal-plans/${list.mealPlanId}/shopping-list`} className="meal-plan-card">
                  <span className="meal-plan-card-top">
                    <span className="meal-plan-card-name">
                      {list.mealPlanName || defaultPlanName(list.startDate, list.days)}
                    </span>
                    <span className={`plan-status ${status.toLowerCase()}`}>{status}</span>
                  </span>
                  <span className="meal-plan-card-range">{formatDateRange(list.startDate, list.days)}</span>
                  <span className="meal-plan-card-meta">
                    {done ? 'All done: ' : ''}{list.checkedCount} of {list.itemCount} in the cart
                    {list.planChangedSince && ' · the meal plan has changed since'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
