import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { recipeApi } from '../services/api'
import RecipeEditor from './RecipeEditor'
import ConfirmDialog from './ConfirmDialog'
import { recipeByline, visibilityLabel } from './recipeSharing'
import PageTitle from './PageTitle'
import './RecipeDetail.css'
import './MealPlan.css'

// "15 OUNCE" for an ingredient bought in a package, e.g. "1 (15-ounce) can corn";
// null when there is no package size.
const formatPackage = ({ packageQuantity, packageUnit }) => {
  if (packageQuantity === null || packageQuantity === undefined) return null
  return packageUnit ? `${packageQuantity} ${packageUnit}` : `${packageQuantity}`
}

function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedNoticeRef = useRef(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const deleteButtonRef = useRef(null)
  // "Exclude from meal plans": saved straight away; the notice says what changed.
  const [exclusionBusy, setExclusionBusy] = useState(false)
  const [exclusionError, setExclusionError] = useState(null)
  const [exclusionNotice, setExclusionNotice] = useState(null)

  useEffect(() => {
    loadRecipe()
  }, [id])

  // After saving from the bottom of the form, bring "Changes saved." into view.
  useEffect(() => {
    if (saved) savedNoticeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [saved])

  const loadRecipe = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await recipeApi.getRecipeById(id)
      setRecipe(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="recipe-detail"><p>Loading recipe...</p></div>
  }

  if (error) {
    return (
      <div className="recipe-detail">
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={() => navigate('/')}>Back to Recipes</button>
        </div>
      </div>
    )
  }

  if (!recipe) {
    return <div className="recipe-detail"><p>Recipe not found</p></div>
  }

  const startEditing = () => {
    setSaved(false)
    setExclusionNotice(null)
    setEditing(true)
  }

  const toggleMealPlanExclusion = async () => {
    const excluded = !recipe.excludedFromMealPlans
    setExclusionBusy(true)
    setExclusionError(null)
    setExclusionNotice(null)
    setSaved(false)
    try {
      await recipeApi.setExcludedFromMealPlans([recipe.id], excluded)
      setRecipe({ ...recipe, excludedFromMealPlans: excluded })
      setExclusionNotice(excluded ? 'Excluded from meal plans.' : 'Included in meal plans again.')
    } catch (err) {
      setExclusionError(err.message)
    } finally {
      setExclusionBusy(false)
    }
  }

  // Show what the server saved (new ids, renumbered steps) straight away, without
  // reloading. If the save fails, RecipeEditor shows the error and keeps the edits.
  const saveRecipe = async (payload) => {
    const updated = await recipeApi.updateRecipe(id, payload)
    setRecipe(updated)
    setEditing(false)
    setSaved(true)
  }

  // Soft delete (the server keeps the row). Replace this page in the history so Back
  // doesn't return to a recipe that no longer loads; the list says what was deleted.
  const deleteRecipe = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await recipeApi.deleteRecipe(id)
      navigate('/', { replace: true, state: { deletedRecipeTitle: recipe.title } })
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
      <div className="recipe-detail">
        <PageTitle title={`Edit ${recipe.title}`} />
        <h1 className="edit-heading">Edit Recipe</h1>
        <RecipeEditor
          initialRecipe={recipe}
          onSubmit={saveRecipe}
          onCancel={() => setEditing(false)}
          submitLabel="Save Changes"
          submittingLabel="Saving..."
          confirmDiscard
        />
      </div>
    )
  }

  return (
    <div className="recipe-detail">
      <div className="detail-actions">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Recipes
        </button>
        <div className="detail-actions-end">
          {/* Only whoever added the recipe can change or delete it; anyone can exclude it from their family's plans. */}
          {recipe.canEdit && (
            <button className="edit-button" onClick={startEditing}>
              Edit Recipe
            </button>
          )}
          <button className="edit-button" onClick={toggleMealPlanExclusion} disabled={exclusionBusy}>
            {recipe.excludedFromMealPlans ? 'Include in meal plans' : 'Exclude from meal plans'}
          </button>
          {recipe.canEdit && (
            <button
              className="delete-button"
              ref={deleteButtonRef}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete Recipe
            </button>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this recipe?"
          message={`“${recipe.title}” will be removed from your recipes.`}
          confirmLabel="Delete"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={deleteRecipe}
          onCancel={cancelDelete}
        />
      )}

      {saved && <p className="save-notice" role="status" ref={savedNoticeRef}>Changes saved.</p>}
      {exclusionNotice && <p className="save-notice" role="status">{exclusionNotice}</p>}
      {exclusionError && <p className="error-message" role="alert">{exclusionError}</p>}

      <header className="recipe-header">
        <PageTitle title={recipe.title} />
        <h1>{recipe.title}</h1>
        <p className="recipe-byline">
          <span className={`visibility-tag visibility-${visibilityLabel(recipe).toLowerCase()}`}>
            {visibilityLabel(recipe)}
          </span>
          {recipeByline(recipe)}
        </p>
        {recipe.excludedFromMealPlans && <p className="excluded-tag">Excluded from meal plans</p>}
        {recipe.description && <p className="description">{recipe.description}</p>}

        <div className="recipe-info">
          {recipe.prepTimeMinutes && (
            <div className="info-item">
              <span className="label">Prep Time:</span>
              <span className="value">{recipe.prepTimeMinutes} min</span>
            </div>
          )}
          {recipe.cookTimeMinutes && (
            <div className="info-item">
              <span className="label">Cook Time:</span>
              <span className="value">{recipe.cookTimeMinutes} min</span>
            </div>
          )}
          {recipe.totalTimeMinutes && (
            <div className="info-item">
              <span className="label">Total Time:</span>
              <span className="value">{recipe.totalTimeMinutes} min</span>
            </div>
          )}
          {recipe.servings && (
            <div className="info-item">
              <span className="label">Servings:</span>
              <span className="value">{recipe.servings}</span>
            </div>
          )}
        </div>

        {recipe.categories && recipe.categories.length > 0 && (
          <div className="categories">
            {recipe.categories.map((cat, idx) => (
              <span key={idx} className="category-tag">{cat}</span>
            ))}
          </div>
        )}
      </header>

      <div className="recipe-content">
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <section className="ingredients-section">
            <h2>Ingredients</h2>
            <ul className="ingredients-list">
              {recipe.ingredients.map((ingredient) => {
                const packageSize = formatPackage(ingredient)
                return (
                  <li key={ingredient.id}>
                    <span className="quantity">
                      {ingredient.quantity} {ingredient.unit}
                      {packageSize && <span className="package"> ({packageSize})</span>}
                    </span>
                    <span className="name">{ingredient.name}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {recipe.equipment && recipe.equipment.length > 0 && (
          <section className="equipment-section">
            <h2>Equipment</h2>
            <ul className="equipment-list">
              {recipe.equipment.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {recipe.steps && recipe.steps.length > 0 && (
          <section className="steps-section">
            <h2>Instructions</h2>
            <ol className="steps-list">
              {[...recipe.steps]
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((step) => (
                  <li key={step.id}>
                    <p className="instruction">{step.instructionText}</p>
                    {step.estimatedTimeMinutes && (
                      <span className="step-time">⏱️ {step.estimatedTimeMinutes} min</span>
                    )}
                  </li>
                ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}

export default RecipeDetail
