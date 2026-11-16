const API_BASE_URL = '/api';

// Error message for a failed response, using the server's explanation when it sent one:
// { "error": "..." } or a validation map like { "ingredients[0].name": "Ingredient name is required" }.
const errorMessage = async (response, fallback) => {
  const body = await response.json().catch(() => null);
  if (body && typeof body === 'object') {
    const details = typeof body.error === 'string'
      ? [body.error]
      : Object.values(body).filter(value => typeof value === 'string');
    if (details.length > 0) return `${fallback}: ${details.join('; ')}`;
  }
  return fallback;
};

export const recipeApi = {
  // Get all recipes
  getAllRecipes: async () => {
    const response = await fetch(`${API_BASE_URL}/recipes`);
    if (!response.ok) throw new Error('Failed to fetch recipes');
    return response.json();
  },

  // Get recipe by ID
  getRecipeById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch recipe');
    return response.json();
  },

  // Create new recipe
  createRecipe: async (recipe) => {
    const response = await fetch(`${API_BASE_URL}/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });
    if (!response.ok) throw new Error('Failed to create recipe');
    return response.json();
  },

  // Update recipe
  updateRecipe: async (id, recipe) => {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to update recipe'));
    return response.json();
  },

  // Delete recipe
  deleteRecipe: async (id) => {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to delete recipe'));
  },

  // Soft delete several recipes in one request (all or nothing). Resolves to
  // { deletedIds }: the ones deleted now, leaving out any that were already deleted.
  deleteRecipes: async (ids) => {
    const response = await fetch(`${API_BASE_URL}/recipes/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to delete recipes'));
    return response.json();
  },

  // Search recipes by title
  searchRecipes: async (title) => {
    const response = await fetch(`${API_BASE_URL}/recipes/search?title=${encodeURIComponent(title)}`);
    if (!response.ok) throw new Error('Failed to search recipes');
    return response.json();
  },

  // Get recipes by category
  getRecipesByCategory: async (category) => {
    const response = await fetch(`${API_BASE_URL}/recipes/category/${encodeURIComponent(category)}`);
    if (!response.ok) throw new Error('Failed to fetch recipes by category');
    return response.json();
  },

  // Get the valid ingredient units: [{ value, label, category }]
  getUnits: async () => {
    const response = await fetch(`${API_BASE_URL}/units`);
    if (!response.ok) throw new Error('Failed to fetch units');
    return response.json();
  },

  importRecipeFromUrl: async (recipeUrl) => {
    const response = await fetch(`${API_BASE_URL}/recipes/import?url=${encodeURIComponent(recipeUrl)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to import recipe');
    }
    return response.json();
  }
};
