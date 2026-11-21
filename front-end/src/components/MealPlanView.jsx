import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { mealPlanApi } from '../services/api'
import MealPlanGrid from './MealPlanGrid'
import MealPlanEditor from './MealPlanEditor'
import ConfirmDialog from './ConfirmDialog'
import { defaultPlanName, formatDateRange, planFromSaved, recipeMeta, slotKey } from './mealPlan'
import './RecipeList.css'
import './RecipeDetail.css'
import './MealPlan.css'

const EDIT_DISCARD = {
  when: 'changed',
  title: 'Discard your changes?',
  message: 'The plan will stay as it was last saved.',
  confirmLabel: 'Discard changes',
}

/**
 * A saved meal plan (/meal-plans/:id). Edit changes its name and meals in place (the same editor as
 * a new plan); Delete removes it after asking. After saving a new plan, the editor sends
 * { savedMealPlan: true } in the router state to show "Meal plan saved."
 */
function MealPlanView() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  // The latest response, tagged with the id it is for: until it matches `id`, the plan is loading.
  const [result, setResult] = useState({ id: null, plan: null, error: null })
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const deleteButtonRef = useRef(null)
  const noticeRef = useRef(null)

  // Keep the notice for this visit, but clear it from the history entry so a reload doesn't repeat it.
  const [notice, setNotice] = useState(() => (location.state?.savedMealPlan ? 'Meal plan saved.' : null))
  useEffect(() => {
    if (location.state?.savedMealPlan) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  // After saving from the bottom of the editor, bring "Changes saved." into view.
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [notice])

  useEffect(() => {
    let ignore = false
    mealPlanApi.getMealPlan(id)
      .then(plan => { if (!ignore) setResult({ id, plan, error: null }) })
      .catch(err => { if (!ignore) setResult({ id, plan: null, error: err.message }) })
    return () => { ignore = true }
  }, [id])

  const loading = result.id !== id
  const { plan, error } = result

  const entries = useMemo(
    () => new Map((plan?.entries ?? []).map(entry => [slotKey(entry.date, entry.mealType), entry])),
    [plan],
  )

  const backButton = (
    <button type="button" className="back-link" onClick={() => navigate('/meal-plans')}>← Back to Meal Plans</button>
  )

  if (loading) {
    return <div className="meal-plan-page"><p>Loading meal plan...</p></div>
  }

  if (error) {
    return (
      <div className="meal-plan-page">
        <div className="meal-plan-top">{backButton}</div>
        <div className="error"><p>Error: {error}</p></div>
      </div>
    )
  }

  const name = plan.name || defaultPlanName(plan.startDate, plan.days)

  // Show what the server saved straight away. If saving fails, the editor shows why and keeps the edits.
  const saveChanges = async (payload) => {
    const updated = await mealPlanApi.updateMealPlan(id, payload)
    setResult({ id, plan: updated, error: null })
    setEditing(false)
    setNotice('Changes saved.')
  }

  // Soft delete. Replace this page in the history so Back doesn't return to a plan that no longer
  // loads; the list says what was deleted.
  const deletePlan = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await mealPlanApi.deleteMealPlan(id)
      navigate('/meal-plans', { replace: true, state: { deletedMealPlanName: name } })
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setConfirmingDelete(false)
    setDeleteError(null)
    deleteButtonRef.current?.focus()
  }

  if (editing) {
    return (
      <div className="meal-plan-page">
        <MealPlanEditor
          initialPlan={planFromSaved(plan)}
          title="Edit Meal Plan"
          saveLabel="Save Changes"
          discard={EDIT_DISCARD}
          onSave={saveChanges}
          onCancel={() => setEditing(false)}
          knownRecipes={plan.entries.map(entry => entry.recipe)}
        />
      </div>
    )
  }

  const renderSlot = (date, mealType) => {
    const entry = entries.get(slotKey(date, mealType))
    if (!entry) {
      return <div className="meal-slot empty"><p className="slot-empty">No meal</p></div>
    }
    const { recipe } = entry
    return (
      <div className="meal-slot">
        {recipe.deleted
          ? <p className="slot-missing">{recipe.title} (no longer available)</p>
          : <Link to={`/recipe/${recipe.id}`} className="slot-title">{recipe.title}</Link>}
        <p className="slot-meta">{recipeMeta(recipe)}</p>
      </div>
    )
  }

  const range = formatDateRange(plan.startDate, plan.days)

  return (
    <div className="meal-plan-page">
      <div className="detail-actions">
        {backButton}
        <div className="detail-actions-end">
          <button type="button" className="edit-button" onClick={() => { setNotice(null); setEditing(true) }}>
            Edit Plan
          </button>
          <button type="button" className="delete-button" ref={deleteButtonRef} onClick={() => setConfirmingDelete(true)}>
            Delete Plan
          </button>
        </div>
      </div>

      {notice && <p className="list-notice" role="status" ref={noticeRef}>{notice}</p>}

      <header className="meal-plan-header">
        <h1>{name}</h1>
        <p className="meal-plan-range">{range}</p>
      </header>

      <MealPlanGrid
        caption={`Meal plan for ${range}`}
        startDate={plan.startDate}
        days={plan.days}
        mealTypes={plan.mealTypes}
        renderSlot={renderSlot}
      />

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this meal plan?"
          message={`“${name}” will be removed from your meal plans.`}
          confirmLabel="Delete"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={deletePlan}
          onCancel={cancelDelete}
        />
      )}
    </div>
  )
}

export default MealPlanView
