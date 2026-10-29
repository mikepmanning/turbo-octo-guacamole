import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { recipeApi } from '../services/api'
import './RecipeDetail.css'

function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRecipe()
  }, [id])

  const loadRecipe = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await recipeApi.getRecipeById(id)
      console.log(data)
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

  return (
    <div className="recipe-detail">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Back to Recipes
      </button>

      <header className="recipe-header">
        <h1>{recipe.title}</h1>
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
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient.id}>
                  <span className="quantity">{ingredient.quantity} {ingredient.unit}</span>
                  <span className="name">{ingredient.name}</span>
                </li>
              ))}
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
              {recipe.steps
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
