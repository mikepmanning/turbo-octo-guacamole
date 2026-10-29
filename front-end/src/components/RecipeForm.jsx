import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { recipeApi } from '../services/api'
import './RecipeForm.css'

function RecipeForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const importedRecipe = location.state?.importedRecipe
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    servings: '',
    prepTimeMinutes: '',
    cookTimeMinutes: '',
    totalTimeMinutes: '',
  })

  const [ingredients, setIngredients] = useState([
    { name: '', quantity: '', unit: '', rawText: '' }
  ])

  const [steps, setSteps] = useState([
    { stepOrder: 1, instructionText: '', estimatedTimeMinutes: '', rawText: ''}
  ])

  const [equipment, setEquipment] = useState([''])
  const [categories, setCategories] = useState([''])

  // Populate form fields if imported data is present
  useEffect(() => {
    if (importedRecipe) {
      setFormData({
        title: importedRecipe.title || '',
        description: importedRecipe.description || '',
        servings: importedRecipe.servings ? String(importedRecipe.servings) : '',
        prepTimeMinutes: importedRecipe.prepTimeMinutes ? String(importedRecipe.prepTimeMinutes) : '',
        cookTimeMinutes: importedRecipe.cookTimeMinutes ? String(importedRecipe.cookTimeMinutes) : '',
        totalTimeMinutes: importedRecipe.totalTimeMinutes ? String(importedRecipe.totalTimeMinutes) : '',
      })

      if (importedRecipe.ingredients && importedRecipe.ingredients.length > 0) {
        setIngredients(
          importedRecipe.ingredients.map(i => ({
            name: i.name || '',
            quantity: i.quantity !== null && i.quantity !== undefined ? String(i.quantity) : '',
            unit: i.unit || '',
            rawText: i.rawString || ''
          }))
        )
      }

      if (importedRecipe.steps && importedRecipe.steps.length > 0) {
        setSteps(
          importedRecipe.steps.map((s, idx) => ({
            stepOrder: s.stepOrder || idx + 1,
            instructionText: s.instructionText || s.instruction || '',
            estimatedTimeMinutes: s.estimatedTimeMinutes ? String(s.estimatedTimeMinutes) : '',
            rawText: s.rawString || ''
          }))
        )
      }

      if (importedRecipe.equipment && importedRecipe.equipment.length > 0) {
        setEquipment(importedRecipe.equipment)
      }

      if (importedRecipe.categories && importedRecipe.categories.length > 0) {
        setCategories(importedRecipe.categories)
      }
    }
  }, [importedRecipe])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleIngredientChange = (index, field, value) => {
    const updated = [...ingredients]
    updated[index][field] = value
    setIngredients(updated)
  }

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '', rawText: '' }])
  }

  const removeIngredient = (index) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index))
    }
  }

  const handleStepChange = (index, field, value) => {
    const updated = [...steps]
    updated[index][field] = value
    setSteps(updated)
  }

  const addStep = () => {
    setSteps([...steps, { stepOrder: steps.length + 1, instructionText: '', estimatedTimeMinutes: '', rawText: '' }])
  }

  const removeStep = (index) => {
    if (steps.length > 1) {
      const updated = steps.filter((_, i) => i !== index)
      // Re-index the steps
      updated.forEach((step, i) => step.stepOrder = i + 1)
      setSteps(updated)
    }
  }

  const handleEquipmentChange = (index, value) => {
    const updated = [...equipment]
    updated[index] = value
    setEquipment(updated)
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
    const updated = [...categories]
    updated[index] = value
    setCategories(updated)
  }

  const addCategory = () => {
    setCategories([...categories, ''])
  }

  const removeCategory = (index) => {
    if (categories.length > 1) {
      setCategories(categories.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // Filter out empty values and prepare data
      const recipeData = {
        ...formData,
        servings: formData.servings ? parseInt(formData.servings) : null,
        prepTimeMinutes: formData.prepTimeMinutes ? parseInt(formData.prepTimeMinutes) : null,
        cookTimeMinutes: formData.cookTimeMinutes ? parseInt(formData.cookTimeMinutes) : null,
        totalTimeMinutes: formData.totalTimeMinutes ? parseInt(formData.totalTimeMinutes) : null,
        ingredients: ingredients
          .filter(i => i.name && i.quantity && i.unit)
          .map(i => ({
            name: i.name,
            quantity: parseFloat(i.quantity),
            unit: i.unit
          })),
        steps: steps
          .filter(s => s.instructionText)
          .map(s => ({
            stepOrder: s.stepOrder,
            instructionText: s.instructionText,
            estimatedTimeMinutes: s.estimatedTimeMinutes ? parseInt(s.estimatedTimeMinutes) : null
          })),
        equipment: equipment.filter(e => e.trim() !== ''),
        categories: categories.filter(c => c.trim() !== '')
      }

      const created = await recipeApi.createRecipe(recipeData)
      navigate(`/recipe/${created.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="recipe-form-container">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Back to Recipes
      </button>

      <h1>{importedRecipe ? 'Import Recipe' : 'Add New Recipe'}</h1>

      {error && (
        <div className="error">
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

                <input
                  type="text"
                  value={ingredient.unit}
                  onChange={(e) =>
                    handleIngredientChange(index, 'unit', e.target.value)
                  }
                  placeholder="Unit"
                  required
                />

                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="remove-btn"
                  disabled={ingredients.length === 1}
                >
                  Remove
                </button>
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
          <button type="button" onClick={() => navigate('/')} className="cancel-btn">
            Cancel
          </button>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Recipe'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RecipeForm
