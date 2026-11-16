import { useNavigate, useLocation } from 'react-router-dom'
import { recipeApi } from '../services/api'
import RecipeEditor from './RecipeEditor'
import './RecipeForm.css'

// "Add New Recipe" page, or "Import Recipe" when the list passes an imported recipe
// in the router state. The form itself is RecipeEditor, shared with editing.
function RecipeForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const importedRecipe = location.state?.importedRecipe

  const createRecipe = async (payload) => {
    const created = await recipeApi.createRecipe(payload)
    navigate(`/recipe/${created.id}`)
  }

  return (
    <div className="recipe-form-container">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Back to Recipes
      </button>

      <h1>{importedRecipe ? 'Import Recipe' : 'Add New Recipe'}</h1>

      <RecipeEditor
        key={location.key}
        initialRecipe={importedRecipe}
        onSubmit={createRecipe}
        onCancel={() => navigate('/')}
        submitLabel="Add Recipe"
        submittingLabel="Adding..."
      />
    </div>
  )
}

export default RecipeForm
