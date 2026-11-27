import { Link, useLocation, useNavigate } from 'react-router-dom'
import { mealPlanApi } from '../services/api'
import MealPlanEditor from './MealPlanEditor'
import PageTitle from './PageTitle'
import './RecipeList.css'
import './MealPlan.css'

const DISCARD = {
  when: 'always',
  title: 'Discard this meal plan?',
  message: "It hasn't been saved, so these meals will be lost.",
  confirmLabel: 'Discard plan',
}

/**
 * Review page for a generated meal plan (/meal-plan/new). The draft comes from the Meal Plans page's
 * "Plan Meals" dialog in the router state; each edit writes it back there, so a refresh keeps it.
 * Nothing is saved until "Save plan"; Cancel discards the draft after asking.
 */
function NewMealPlan() {
  const location = useLocation()
  const navigate = useNavigate()
  const draft = location.state?.mealPlan

  if (!draft) {
    return (
      <div className="meal-plan-page">
        <PageTitle title="New Meal Plan" />
        <h1>Meal Plan</h1>
        <p>No meal plan in progress. Use “Plan Meals” on the Meal Plans page to start one.</p>
        <Link to="/meal-plans" className="create-recipe-btn">Go to Meal Plans</Link>
      </div>
    )
  }

  const save = async (payload) => {
    const saved = await mealPlanApi.createMealPlan(payload)
    // Replace the draft in the history, so Back doesn't return to a plan that's already saved.
    navigate(`/meal-plans/${saved.id}`, { replace: true, state: { savedMealPlan: true } })
  }

  return (
    <div className="meal-plan-page">
      <PageTitle title="New Meal Plan" />
      <MealPlanEditor
        initialPlan={draft}
        title="Meal Plan"
        backLabel="← Back to Meal Plans"
        saveLabel="Save plan"
        discard={DISCARD}
        onSave={save}
        onCancel={() => navigate('/meal-plans', { replace: true })}
        onChange={(mealPlan) => navigate(location.pathname, { replace: true, state: { mealPlan } })}
      />
    </div>
  )
}

export default NewMealPlan
