import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { recipeApi } from '../services/api'
import ImportRecipeModal from './ImportRecipeModal'
import './RecipeList.css'

function RecipeList() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  
  const navigate = useNavigate();

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    try {
      setLoading(true)
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
        </div>
      </header>

      <main>
        {loading && <p>Loading recipes...</p>}

        {error && (
          <div className="error">
            <p>Error: {error}</p>
            <button onClick={loadRecipes}>Retry</button>
          </div>
        )}

        {!loading && !error && recipes.length === 0 && (
          <p>No recipes found. Create your first recipe!</p>
        )}

        {!loading && !error && recipes.length > 0 && (
          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipe/${recipe.id}`}
                className="recipe-card"
              >
                <h2>{recipe.title}</h2>
                <p className="description">{recipe.description}</p>
                <div className="recipe-meta">
                  <span>⏱️ {recipe.totalTimeMinutes} min</span>
                  <span>🍽️ {recipe.servings} servings</span>
                </div>
                {recipe.categories && recipe.categories.length > 0 && (
                  <div className="categories">
                    {recipe.categories.map((cat, idx) => (
                      <span key={idx} className="category-tag">{cat}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
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
