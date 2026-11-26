import { useState, useEffect, useRef } from 'react'
import { recipeApi } from '../services/api'
import { recipeToFormState, formStateToPayload, blankIngredient, blankStep } from './recipeFormState'
import './RecipeForm.css'

// Dropdown groups, in display order. Units come from GET /api/units.
const UNIT_GROUPS = [
  { category: 'VOLUME', label: 'Volume' },
  { category: 'WEIGHT', label: 'Weight' },
  { category: 'CONTAINER', label: 'Container' },
  { category: 'COUNT', label: 'Count' },
]

// A package size is always a measurement, e.g. "15 ounce" in "1 (15-ounce) can".
const PACKAGE_CATEGORIES = ['VOLUME', 'WEIGHT']

function UnitOptions({ units, categories }) {
  return UNIT_GROUPS
    .filter(group => !categories || categories.includes(group.category))
    .map(group => {
      const options = units.filter(u => u.category === group.category)
      if (options.length === 0) return null
      return (
        <optgroup key={group.category} label={group.label}>
          {options.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </optgroup>
      )
    })
}


/**
 * The recipe form, shared by "Add/Import Recipe" (RecipeForm) and "Edit Recipe" (RecipeDetail).
 *
 * - initialRecipe: recipe to pre-fill from (saved or imported); omit for a blank form.
 *   Read once on mount; give the component a new `key` to start over.
 * - onSubmit(payload): saves the recipe; if it throws, its message is shown and the
 *   user can try again.
 * - onCancel(): called by Cancel. With confirmDiscard, asks first if anything was changed.
 */
function RecipeEditor({
  initialRecipe,
  onSubmit,
  onCancel,
  submitLabel,
  submittingLabel,
  confirmDiscard = false,
}) {
  const [initialState] = useState(() => recipeToFormState(initialRecipe))
  const [formData, setFormData] = useState(initialState.formData)
  const [ingredients, setIngredients] = useState(initialState.ingredients)
  const [steps, setSteps] = useState(initialState.steps)
  const [equipment, setEquipment] = useState(initialState.equipment)
  const [categories, setCategories] = useState(initialState.categories)
  const [units, setUnits] = useState([])
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const errorRef = useRef(null)

  // Save is at the bottom of a long form and the error is at the top: bring it into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [error])

  // Load the valid units for the unit dropdowns
  useEffect(() => {
    recipeApi.getUnits()
      .then(setUnits)
      .catch(err => setError(`Could not load units: ${err.message}`))
  }, [])

  const currentState = () => ({
    formData, sourceUrl: initialState.sourceUrl, ingredients, steps, equipment, categories,
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Row updates copy the row rather than changing it, so the initial state stays intact.
  const handleIngredientChange = (index, field, value) => {
    setIngredients(ingredients.map((i, idx) => (idx === index ? { ...i, [field]: value } : i)))
  }

  const addIngredient = () => {
    setIngredients([...ingredients, blankIngredient()])
  }

  const removeIngredient = (index) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index))
    }
  }

  const handleStepChange = (index, field, value) => {
    setSteps(steps.map((s, idx) => (idx === index ? { ...s, [field]: value } : s)))
  }

  const addStep = () => {
    setSteps([...steps, blankStep(steps.length + 1)])
  }

  const removeStep = (index) => {
    if (steps.length > 1) {
      // Re-number the remaining steps
      setSteps(steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, stepOrder: i + 1 })))
    }
  }

  const handleEquipmentChange = (index, value) => {
    setEquipment(equipment.map((e, idx) => (idx === index ? value : e)))
  }

  const addEquipment = () => {
    setEquipment([...equipment, ''])
  }

  const removeEquipment = (index) => {
    if (equipment.length > 1) {
      setEquipment(equipment.filter((_, i) => i !== index))
    }
  }

  const handleCategoryChange = (index, value) => {
    setCategories(categories.map((c, idx) => (idx === index ? value : c)))
  }

  const addCategory = () => {
    setCategories([...categories, ''])
  }

  const removeCategory = (index) => {
    if (categories.length > 1) {
      setCategories(categories.filter((_, i) => i !== index))
    }
  }

  const handleCancel = () => {
    const changed = JSON.stringify(currentState()) !== JSON.stringify(initialState)
    if (confirmDiscard && changed && !window.confirm('Discard your changes?')) return
    onCancel()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(formStateToPayload(currentState()))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {error && (
        <div className="error" ref={errorRef}>
          <p>Error: {error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="recipe-form">
        {/* Basic Information */}
        <section className="form-section">
          <h2>Basic Information</h2>

          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="servings">Servings *</label>
              <input
                type="number"
                id="servings"
                name="servings"
                value={formData.servings}
                onChange={handleInputChange}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="prepTimeMinutes">Prep Time (min)</label>
              <input
                type="number"
                id="prepTimeMinutes"
                name="prepTimeMinutes"
                value={formData.prepTimeMinutes}
                onChange={handleInputChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cookTimeMinutes">Cook Time (min)</label>
              <input
                type="number"
                id="cookTimeMinutes"
                name="cookTimeMinutes"
                value={formData.cookTimeMinutes}
                onChange={handleInputChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="totalTimeMinutes">Total Time (min)</label>
              <input
                type="number"
                id="totalTimeMinutes"
                name="totalTimeMinutes"
                value={formData.totalTimeMinutes}
                onChange={handleInputChange}
                min="0"
              />
            </div>
          </div>
        </section>

        {/* Who can see it */}
        <section className="form-section">
          <h2>Sharing</h2>
          <fieldset className="visibility-options">
            <legend>Who can see this recipe?</legend>
            <label className="visibility-option">
              <input
                type="radio"
                name="visibility"
                value="PRIVATE"
                checked={formData.visibility === 'PRIVATE'}
                onChange={handleInputChange}
              />
              <span>
                <strong>Private</strong>
                <span className="visibility-hint">Only you and your family</span>
              </span>
            </label>
            <label className="visibility-option">
              <input
                type="radio"
                name="visibility"
                value="PUBLIC"
                checked={formData.visibility === 'PUBLIC'}
                onChange={handleInputChange}
              />
              <span>
                <strong>Public</strong>
                <span className="visibility-hint">Everyone using RecipeHome</span>
              </span>
            </label>
          </fieldset>
        </section>

        {/* Categories */}
        <section className="form-section">
          <h2>Categories</h2>
          {categories.map((category, index) => (
            <div key={index} className="dynamic-field">
              <input
                type="text"
                value={category}
                onChange={(e) => handleCategoryChange(index, e.target.value)}
                placeholder="e.g., Dessert, Dinner, Italian"
              />
              <button
                type="button"
                onClick={() => removeCategory(index)}
                className="remove-btn"
                disabled={categories.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addCategory} className="add-btn">
            + Add Category
          </button>
        </section>

        {/* Ingredients */}
        <section className="form-section">
          <h2>Ingredients *</h2>
          {ingredients.map((ingredient, index) => (
            <div key={index} className="ingredient-field-container">
          
              {ingredient.rawText && (
                <div className="raw-text-field">
                  <label htmlFor={`ingredient-raw-${index}`}>
                    Original Ingredient Text
                  </label>
                  <input
                    type="text"
                    id={`ingredient-raw-${index}`}
                    value={ingredient.rawText}
                    readOnly
                  />
                </div>
              )}

              <div className="ingredient-field">
                <input
                  type="text"
                  value={ingredient.name}
                  onChange={(e) =>
                    handleIngredientChange(index, 'name', e.target.value)
                  }
                  placeholder="Ingredient name"
                  required
                />

                <input
                  type="number"
                  step="0.01"
                  value={ingredient.quantity}
                  onChange={(e) =>
                    handleIngredientChange(index, 'quantity', e.target.value)
                  }
                  placeholder="Qty"
                  required
                />

                <select
                  value={ingredient.unit}
                  onChange={(e) =>
                    handleIngredientChange(index, 'unit', e.target.value)
                  }
                  aria-label="Unit"
                  required
                >
                  <option value="" disabled>Unit</option>
                  <UnitOptions units={units} />
                </select>

                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="remove-btn"
                  disabled={ingredients.length === 1}
                >
                  Remove
                </button>
              </div>

              <div className="package-field">
                <label htmlFor={`ingredient-package-qty-${index}`}>
                  Package size
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id={`ingredient-package-qty-${index}`}
                  value={ingredient.packageQuantity}
                  onChange={(e) =>
                    handleIngredientChange(index, 'packageQuantity', e.target.value)
                  }
                  placeholder="e.g. 15"
                  aria-label="Package quantity"
                  required={ingredient.packageUnit !== ''}
                />
                <select
                  value={ingredient.packageUnit}
                  onChange={(e) =>
                    handleIngredientChange(index, 'packageUnit', e.target.value)
                  }
                  aria-label="Package unit"
                  required={ingredient.packageQuantity !== ''}
                >
                  <option value="">No package</option>
                  <UnitOptions units={units} categories={PACKAGE_CATEGORIES} />
                </select>
              </div>
            </div>
          ))}
          <button type="button" onClick={addIngredient} className="add-btn">
            + Add Ingredient
          </button>
        </section>

        {/* Equipment */}
        <section className="form-section">
          <h2>Equipment</h2>
          {equipment.map((item, index) => (
            <div key={index} className="dynamic-field">
              <input
                type="text"
                value={item}
                onChange={(e) => handleEquipmentChange(index, e.target.value)}
                placeholder="e.g., Mixing bowl, Baking sheet"
              />
              <button
                type="button"
                onClick={() => removeEquipment(index)}
                className="remove-btn"
                disabled={equipment.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addEquipment} className="add-btn">
            + Add Equipment
          </button>
        </section>

        {/* Steps */}
        <section className="form-section">
          <h2>Instructions *</h2>
          {steps.map((step, index) => (
            <div key={index} className="step-field">
              <div className="step-header">
                <span className="step-number">Step {step.stepOrder}</span>
              </div>

               {step.rawText && (
                  <div className="raw-text-field">
                    <label htmlFor={`step-raw-${index}`}>
                      Original Step Text
                    </label>
                    <input
                      type="text"
                      id={`step-raw-${index}`}
                      value={step.rawText}
                      readOnly
                    />
                  </div>
                )}

              <textarea
                value={step.instructionText}
                onChange={(e) => handleStepChange(index, 'instructionText', e.target.value)}
                placeholder="Instruction text"
                rows="3"
                required
              />

              <div className="step-footer">
                <input
                  type="number"
                  value={step.estimatedTimeMinutes}
                  onChange={(e) => handleStepChange(index, 'estimatedTimeMinutes', e.target.value)}
                  placeholder="Time (min)"
                  min="0"
                />
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="remove-btn"
                  disabled={steps.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addStep} className="add-btn">
            + Add Step
          </button>
        </section>

        {/* Submit */}
        <div className="form-actions">
          <button type="button" onClick={handleCancel} className="cancel-btn" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </>
  )
}

export default RecipeEditor
