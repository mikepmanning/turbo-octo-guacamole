const API_BASE_URL = '/api';

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
    if (!response.ok) throw new Error('Failed to update recipe');
    return response.json();
  },

  // Delete recipe
  deleteRecipe: async (id) => {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete recipe');
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

  importRecipeFromUrl: async (recipeUrl) => {
    console.log("In import api");
    const response = await fetch(`${API_BASE_URL}/recipes/import?url=${encodeURIComponent(recipeUrl)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    console.log(response);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to import recipe');
    }
    return response.json();
  }
};
