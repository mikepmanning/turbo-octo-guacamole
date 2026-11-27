import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { mealPlanApi, recipeApi } from '../services/api'
import MealPlanSetupModal from './MealPlanSetupModal'
import { defaultPlanName, formatDateRange, mealLabel, planStatus, todayString } from './mealPlan'
import { creatorName } from './recipeSharing'
import PageTitle from './PageTitle'
import './RecipeList.css'
import './MealPlan.css'

const mealCount = (n) => `${n} ${n === 1 ? 'meal' : 'meals'}`

/**
 * The saved meal plans (/meal-plans), latest start date first, each opening its plan, and
 * "Plan Meals" to make a new one. After a delete, MealPlanView sends the plan's name here to say
 * it was deleted.
 */
function MealPlanList() {
  const location = useLocation()
  const navigate = useNavigate()

  // The plans, tagged with the load attempt they answer: until it matches, they are loading.
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: null, plans: [], error: null })
  const loading = result.attempt !== attempt
  const { plans, error } = result

  // The recipes "Plan Meals" draws from, loaded in the background so the dialog is usually
  // ready straight away (it says "Loading recipes..." if opened sooner).
  const [recipesAttempt, setRecipesAttempt] = useState(0)
  const [recipesResult, setRecipesResult] = useState({ attempt: null, recipes: null, error: null })
  const recipesLoaded = recipesResult.attempt === recipesAttempt
  const [planning, setPlanning] = useState(false)

  // Keep the notice for this visit, but clear it from the history entry so a reload doesn't repeat it.
  const [notice] = useState(() => {
    const name = location.state?.deletedMealPlanName
    return name ? `“${name}” was deleted.` : null
  })
  useEffect(() => {
    if (location.state?.deletedMealPlanName) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  useEffect(() => {
    let ignore = false
    mealPlanApi.getMealPlans()
      .then(data => { if (!ignore) setResult({ attempt, plans: data, error: null }) })
      .catch(err => { if (!ignore) setResult({ attempt, plans: [], error: err.message }) })
    return () => { ignore = true }
  }, [attempt])

  useEffect(() => {
    let ignore = false
    recipeApi.getAllRecipes()
      .then(data => { if (!ignore) setRecipesResult({ attempt: recipesAttempt, recipes: data, error: null }) })
      .catch(err => { if (!ignore) setRecipesResult({ attempt: recipesAttempt, recipes: null, error: err.message }) })
    return () => { ignore = true }
  }, [recipesAttempt])

  // The generated plan isn't saved yet: the review page gets it in the router state.
  const handlePlanGenerated = (mealPlan) => {
    navigate('/meal-plan/new', { state: { mealPlan } })
  }

  const today = todayString()

  return (
    <div className="meal-plan-page">
      <div className="meal-plan-top">
        <Link to="/" className="back-link">← Back to Recipes</Link>
      </div>

      {notice && <p className="list-notice" role="status">{notice}</p>}

      <header className="meal-plan-header">
        <PageTitle title="Meal Plans" />
        <h1>Meal Plans</h1>
        <p className="meal-plan-range">Your saved meal plans, latest first.</p>
        <div className="header-actions">
          <button type="button" className="create-recipe-btn" onClick={() => setPlanning(true)}>
            Plan Meals
          </button>
        </div>
      </header>

      {loading && <p>Loading meal plans...</p>}

      {!loading && error && (
        <div className="error">
          <p>Error: {error}</p>
          <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button>
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="meal-plans-empty">
          <p>No meal plans yet. Use “Plan Meals” to make one.</p>
        </div>
      )}

      {!loading && !error && plans.length > 0 && (
        <ul className="meal-plan-cards">
          {plans.map(plan => {
            const status = planStatus(plan.startDate, plan.endDate, today)
            return (
              <li key={plan.id}>
                <Link to={`/meal-plans/${plan.id}`} className="meal-plan-card">
                  <span className="meal-plan-card-top">
                    <span className="meal-plan-card-name">{plan.name || defaultPlanName(plan.startDate, plan.days)}</span>
                    <span className={`plan-status ${status.toLowerCase()}`}>{status}</span>
                  </span>
                  <span className="meal-plan-card-range">{formatDateRange(plan.startDate, plan.days)}</span>
                  <span className="meal-plan-card-meta">
                    {plan.mealTypes.map(mealLabel).join(' · ')} — {mealCount(plan.mealCount)}
                  </span>
                  {!plan.canDelete && creatorName(plan) && (
                    <span className="meal-plan-card-creator">Created by {creatorName(plan)}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {planning && (
        <MealPlanSetupModal
          recipes={recipesLoaded ? recipesResult.recipes : null}
          loadError={recipesLoaded ? recipesResult.error : null}
          onRetry={() => setRecipesAttempt(n => n + 1)}
          onClose={() => setPlanning(false)}
          onGenerate={handlePlanGenerated}
        />
      )}
    </div>
  )
}

export default MealPlanList
