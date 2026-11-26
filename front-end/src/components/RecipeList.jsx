import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { recipeApi } from '../services/api'
import ImportRecipeModal from './ImportRecipeModal'
import ConfirmDialog from './ConfirmDialog'
import SelectionBar from './SelectionBar'
import { recipeByline } from './recipeSharing'
import RecipeSearch from './RecipeSearch'
import { emptyFilters, filterRecipes, hasActiveFilters, knownCategories, matchNotes } from './recipeFilters'
import './RecipeList.css'
import './MealPlan.css'

// How many titles the delete confirmation lists before "…and N more".
const TITLES_SHOWN = 5

const recipeCount = (n) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`

// The notice after a bulk delete. The server only reports what it deleted; anything else
// selected had already been deleted (e.g. in another tab).
function bulkDeleteNotice(selectedCount, deletedCount) {
  const alreadyDeleted = selectedCount - deletedCount
  if (deletedCount === 0) {
    return alreadyDeleted === 1 ? 'That recipe had already been deleted.' : 'Those recipes had already been deleted.'
  }
  const notice = `Deleted ${recipeCount(deletedCount)}.`
  return alreadyDeleted > 0 ? `${notice} ${alreadyDeleted} had already been deleted.` : notice
}

function RecipeCardContent({ recipe, titleId, notes = [] }) {
  return (
    <>
      <h2 id={titleId}>{recipe.title}</h2>
      <p className="description">{recipe.description}</p>
      {notes.map(({ label, values }) => (
        <p key={label} className="match-note">Matches {label}: {values.join('; ')}</p>
      ))}
      <div className="recipe-meta">
        <span>⏱️ {recipe.totalTimeMinutes} min</span>
        <span>🍽️ {recipe.servings} servings</span>
        {recipe.visibility === 'PRIVATE' && <span className="visibility-tag visibility-private">Private</span>}
        {recipe.excludedFromMealPlans && <span className="excluded-tag">Not in meal plans</span>}
      </div>
      {!recipe.canEdit && <p className="recipe-card-byline">{recipeByline(recipe)}</p>}
      {recipe.categories && recipe.categories.length > 0 && (
        <div className="categories">
          {recipe.categories.map((cat, idx) => (
            <span key={idx} className="category-tag">{cat}</span>
          ))}
        </div>
      )}
    </>
  )
}

function RecipeList() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Search: filters the loaded recipes in the browser (see recipeFilters.js).
  const [filters, setFilters] = useState(emptyFilters)
  const searchInputRef = useRef(null)
  const visibleRecipes = useMemo(() => filterRecipes(recipes, filters), [recipes, filters])
  const categories = useMemo(() => knownCategories(recipes), [recipes])
  const searching = hasActiveFilters(filters)

  // Selection mode: cards select instead of opening, and the selection bar is shown.
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const deleteButtonRef = useRef(null)
  const noticeRef = useRef(null)
  const [updatingMealPlans, setUpdatingMealPlans] = useState(false)
  const [selectionError, setSelectionError] = useState(null)

  const navigate = useNavigate();
  const location = useLocation()

  // After a delete on RecipeDetail, it sends the recipe's title here. Keep it for this visit and
  // clear it from the history entry, so reloading the list doesn't announce it again.
  const [notice, setNotice] = useState(() => {
    const title = location.state?.deletedRecipeTitle
    return title ? `“${title}” was deleted.` : null
  })
  useEffect(() => {
    if (location.state?.deletedRecipeTitle) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  // Bulk delete is triggered from a bar that may be scrolled far down: bring the notice into view.
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [notice])

  useEffect(() => {
    loadRecipes()
  }, [])

  // Escape leaves selection mode (while the dialog is open, Escape closes the dialog instead).
  useEffect(() => {
    if (!selecting || confirmingDelete) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelecting(false)
        setSelectedIds(new Set())
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selecting, confirmingDelete])

  // `quiet` refreshes without swapping the list for "Loading recipes..."
  const loadRecipes = async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true)
      setError(null)
      const data = await recipeApi.getAllRecipes()
      setRecipes(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleImportSuccess = (importedrecipeData) => {
    navigate('/recipe/new', {state: { importedRecipe: importedrecipeData}})
  }

  // Selection only ever covers recipes on screen: narrowing the search drops hidden ones,
  // so "Delete (N)" never includes a recipe the user can't see.
  const changeFilters = (next) => {
    setFilters(next)
    if (selecting) {
      const stillVisible = new Set(filterRecipes(recipes, next).map(recipe => recipe.id))
      setSelectedIds(prev => new Set([...prev].filter(id => stillVisible.has(id))))
    }
  }

  const clearSearch = () => {
    changeFilters(emptyFilters())
    searchInputRef.current?.focus()
  }

  const stopSelecting = () => {
    setSelecting(false)
    setSelectedIds(new Set())
    setSelectionError(null)
  }

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // In list order, for the confirmation and the request.
  const selectedRecipes = visibleRecipes.filter(recipe => selectedIds.has(recipe.id))

  const deleteSelected = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const { deletedIds } = await recipeApi.deleteRecipes(selectedRecipes.map(recipe => recipe.id))
      setNotice(bulkDeleteNotice(selectedRecipes.length, deletedIds.length))
      setConfirmingDelete(false)
      stopSelecting()
      await loadRecipes({ quiet: true })
    } catch (err) {
      // Nothing was deleted (the server deletes all or none): keep the selection to retry.
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // Exclude the selection from meal plans, or include it again; then show the refreshed list.
  const setMealPlanExclusion = async (excluded) => {
    setUpdatingMealPlans(true)
    setSelectionError(null)
    try {
      const { updatedIds } = await recipeApi.setExcludedFromMealPlans(selectedRecipes.map(recipe => recipe.id), excluded)
      setNotice(updatedIds.length === 0
        ? 'Those recipes had already been deleted.'
        : `${recipeCount(updatedIds.length)} ${excluded ? 'excluded from' : 'included in'} meal plans.`)
      stopSelecting()
      await loadRecipes({ quiet: true })
    } catch (err) {
      // Keep the selection to try again.
      setSelectionError(err.message)
    } finally {
      setUpdatingMealPlans(false)
    }
  }

  const cancelDelete = () => {
    setConfirmingDelete(false)
    setDeleteError(null)
    deleteButtonRef.current?.focus()
  }

  const showingRecipes = !loading && !error && recipes.length > 0

  return (
    <div className="recipe-list">
      <header>
        <h1>RecipeHome</h1>
        <p>Your personal recipe collection</p>
        <div className="header-actions">
          <Link to="/recipe/new" className="create-recipe-btn">
            + Add Recipe
          </Link>
          <button type="button" onClick={()=> setIsImportModalOpen(true)} className="create-recipe-btn secondary-btn">
            + Import Recipe
          </button>
          <Link to="/meal-plans" className="create-recipe-btn secondary-btn">
            Meal Plans
          </Link>
          {/* Always there (so the header doesn't jump), but only usable when there are cards to select */}
          {!selecting && (
            <button
              type="button"
              onClick={() => { setSelecting(true); setNotice(null) }}
              className="create-recipe-btn secondary-btn"
              disabled={!showingRecipes || visibleRecipes.length === 0}
            >
              Select
            </button>
          )}
        </div>
      </header>

      <main>
        {notice && (
          <p className="list-notice" role="status" ref={noticeRef}>{notice}</p>
        )}

        {/* Always there, even while loading: filters apply to the recipes once they arrive. */}
        <RecipeSearch
          filters={filters}
          onChange={changeFilters}
          categories={categories}
          searchInputRef={searchInputRef}
        />

        {loading && <p>Loading recipes...</p>}

        {error && (
          <div className="error">
            <p>Error: {error}</p>
            <button onClick={() => loadRecipes()}>Retry</button>
          </div>
        )}

        {!loading && !error && recipes.length === 0 && (
          <p>No recipes found. Create your first recipe!</p>
        )}

        {/* Announced as the filters change */}
        {showingRecipes && (
          <div aria-live="polite">
            {searching && visibleRecipes.length > 0 && (
              <p className="search-summary">
                Showing {visibleRecipes.length} of {recipeCount(recipes.length)}
              </p>
            )}
            {searching && visibleRecipes.length === 0 && (
              <div className="no-matches">
                <p>No recipes match your search.</p>
                <button type="button" onClick={clearSearch}>Clear search</button>
              </div>
            )}
          </div>
        )}

        {showingRecipes && selecting && (
          <SelectionBar
            selectedCount={selectedIds.size}
            totalCount={visibleRecipes.length}
            onSelectAll={() => setSelectedIds(new Set(visibleRecipes.map(recipe => recipe.id)))}
            onClear={() => setSelectedIds(new Set())}
            onCancel={stopSelecting}
            onDelete={() => setConfirmingDelete(true)}
            deleteButtonRef={deleteButtonRef}
            deleteBlockedReason={selectedRecipes.some(recipe => !recipe.canEdit)
              ? 'You can only delete recipes you added'
              : null}
            onExclude={() => setMealPlanExclusion(true)}
            onInclude={() => setMealPlanExclusion(false)}
            busy={updatingMealPlans}
          />
        )}

        {selecting && selectionError && <p className="error-message" role="alert">{selectionError}</p>}

        {showingRecipes && visibleRecipes.length > 0 && (
          <div className="recipe-grid">
            {visibleRecipes.map((recipe) => {
              const notes = searching ? matchNotes(recipe, filters) : []
              if (!selecting) {
                return (
                  <Link key={recipe.id} to={`/recipe/${recipe.id}`} className="recipe-card">
                    <RecipeCardContent recipe={recipe} notes={notes} />
                  </Link>
                )
              }
              // Clicking anywhere on the card toggles it; the checkbox is for keyboard and screen readers.
              const selected = selectedIds.has(recipe.id)
              const titleId = `recipe-title-${recipe.id}`
              return (
                <div
                  key={recipe.id}
                  className={`recipe-card selectable${selected ? ' selected' : ''}`}
                  onClick={() => toggleSelected(recipe.id)}
                >
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    checked={selected}
                    onChange={() => toggleSelected(recipe.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-labelledby={titleId}
                  />
                  <RecipeCardContent recipe={recipe} titleId={titleId} notes={notes} />
                </div>
              )
            })}
          </div>
        )}

        {confirmingDelete && (
          <ConfirmDialog
            title={`Delete ${recipeCount(selectedRecipes.length)}?`}
            message={selectedRecipes.length === 1
              ? 'This recipe will be removed from your collection:'
              : 'These recipes will be removed from your collection:'}
            confirmLabel={`Delete ${recipeCount(selectedRecipes.length)}`}
            busyLabel="Deleting..."
            busy={deleting}
            error={deleteError}
            onConfirm={deleteSelected}
            onCancel={cancelDelete}
          >
            <ul className="confirm-list">
              {selectedRecipes.slice(0, TITLES_SHOWN).map(recipe => (
                <li key={recipe.id}>{recipe.title}</li>
              ))}
              {selectedRecipes.length > TITLES_SHOWN && (
                <li className="confirm-more">…and {selectedRecipes.length - TITLES_SHOWN} more</li>
              )}
            </ul>
          </ConfirmDialog>
        )}

        <ImportRecipeModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={handleImportSuccess}
      />
      </main>
    </div>
  )
}

export default RecipeList
