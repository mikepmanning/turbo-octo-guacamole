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

// --- Login session -------------------------------------------------------------------------
// The token from register/login is kept in localStorage with its expiry and the user, so a
// refresh or a new tab stays logged in until the token expires (7 days by default).
export const SESSION_KEY = 'recipehome.session';
// Fired on window when the server rejects the token (expired, or the server's key changed),
// so the app can send the user back to the login page.
export const SESSION_EXPIRED_EVENT = 'recipehome:session-expired';

// The stored session { token, expiresAt, user }, or null when there is none or it has expired.
export const getSession = () => {
  let session;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    session = null;
  }
  if (!session?.token) return null;
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
};

export const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));

export const clearSession = () => localStorage.removeItem(SESSION_KEY);

// fetch with the logged-in user's token. With no session the arguments go through unchanged.
// A 401 means the token no longer works: forget it and tell the app.
const apiFetch = async (url, options) => {
  const session = getSession();
  const request = session
    ? { ...options, headers: { ...options?.headers, Authorization: `Bearer ${session.token}` } }
    : options;
  const response = request ? await fetch(url, request) : await fetch(url);
  if (response.status === 401 && session) {
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
};

// Error for a failed register/login: the message, plus `fieldErrors` ({ email: '...' })
// when the server said which fields were wrong.
const authError = async (response, fallback) => {
  const body = await response.json().catch(() => null);
  const error = new Error(typeof body?.error === 'string' ? body.error : fallback);
  if (body && typeof body === 'object' && typeof body.error !== 'string') {
    error.fieldErrors = body;
    const messages = Object.values(body).filter(value => typeof value === 'string');
    if (messages.length > 0) error.message = messages.join('; ');
  }
  return error;
};

const postAuth = async (path, body, fallback) => {
  const response = await fetch(`${API_BASE_URL}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await authError(response, fallback);
  return response.json();
};

export const authApi = {
  // Create an account: { email, password, firstName, lastName, dateOfBirth: 'YYYY-MM-DD' }.
  // Resolves to { token, expiresAt, user } (the new user is logged in).
  register: (account) => postAuth('register', account, 'Could not create your account'),

  // Resolves to { token, expiresAt, user }; rejects with "Invalid email or password".
  login: (email, password) => postAuth('login', { email, password }, 'Could not log in'),

  // The logged-in user: { id, email, firstName, lastName, dateOfBirth }
  getCurrentUser: async () => {
    const response = await apiFetch(`${API_BASE_URL}/auth/me`);
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load your account'));
    return response.json();
  },
};

export const recipeApi = {
  // Get all recipes
  getAllRecipes: async () => {
    const response = await apiFetch(`${API_BASE_URL}/recipes`);
    if (!response.ok) throw new Error('Failed to fetch recipes');
    return response.json();
  },

  // Get recipe by ID
  getRecipeById: async (id) => {
    const response = await apiFetch(`${API_BASE_URL}/recipes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch recipe');
    return response.json();
  },

  // Create new recipe
  createRecipe: async (recipe) => {
    const response = await apiFetch(`${API_BASE_URL}/recipes`, {
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
    const response = await apiFetch(`${API_BASE_URL}/recipes/${id}`, {
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
    const response = await apiFetch(`${API_BASE_URL}/recipes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to delete recipe'));
  },

  // Soft delete several recipes in one request (all or nothing). Resolves to
  // { deletedIds }: the ones deleted now, leaving out any that were already deleted.
  deleteRecipes: async (ids) => {
    const response = await apiFetch(`${API_BASE_URL}/recipes/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to delete recipes'));
    return response.json();
  },

  // Exclude recipes from meal plans (excluded = true) or include them again. Resolves to
  // { updatedIds }: the recipes now set that way, leaving out any that were deleted.
  setExcludedFromMealPlans: async (ids, excluded) => {
    const response = await apiFetch(`${API_BASE_URL}/recipes/meal-plan-exclusion`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids, excluded }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to update meal plan settings'));
    return response.json();
  },

  // Search recipes by title
  searchRecipes: async (title) => {
    const response = await apiFetch(`${API_BASE_URL}/recipes/search?title=${encodeURIComponent(title)}`);
    if (!response.ok) throw new Error('Failed to search recipes');
    return response.json();
  },

  // Get recipes by category
  getRecipesByCategory: async (category) => {
    const response = await apiFetch(`${API_BASE_URL}/recipes/category/${encodeURIComponent(category)}`);
    if (!response.ok) throw new Error('Failed to fetch recipes by category');
    return response.json();
  },

  // Get the valid ingredient units: [{ value, label, category }]
  getUnits: async () => {
    const response = await apiFetch(`${API_BASE_URL}/units`);
    if (!response.ok) throw new Error('Failed to fetch units');
    return response.json();
  },

  importRecipeFromUrl: async (recipeUrl) => {
    const response = await apiFetch(`${API_BASE_URL}/recipes/import?url=${encodeURIComponent(recipeUrl)}`, {
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

export const mealPlanApi = {
  // Save a new meal plan: { name, startDate, days, mealTypes, entries: [{ date, mealType, recipeId }] }.
  // Resolves to the saved plan, with a recipe summary in each entry.
  createMealPlan: async (plan) => {
    const response = await apiFetch(`${API_BASE_URL}/meal-plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plan),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to save meal plan'));
    return response.json();
  },

  // Get every saved meal plan, latest start date first: summaries with mealCount instead of entries
  getMealPlans: async () => {
    const response = await apiFetch(`${API_BASE_URL}/meal-plans`);
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load meal plans'));
    return response.json();
  },

  // Meals already planned from `from` to `to` ('YYYY-MM-DD', inclusive) in any saved plan:
  // [{ date, mealType, recipeId, recipeTitle, mealPlanId, mealPlanName, mealPlanStartDate, mealPlanDays }]
  getPlannedMeals: async (from, to) => {
    const params = new URLSearchParams({ from, to });
    const response = await apiFetch(`${API_BASE_URL}/meal-plans/meals?${params}`);
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load planned meals'));
    return response.json();
  },

  // Get a saved meal plan by ID
  getMealPlan: async (id) => {
    const response = await apiFetch(`${API_BASE_URL}/meal-plans/${id}`);
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load meal plan'));
    return response.json();
  },

  // Replace a saved meal plan's name and meals (same body as createMealPlan); resolves to the updated plan
  updateMealPlan: async (id, plan) => {
    const response = await apiFetch(`${API_BASE_URL}/meal-plans/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plan),
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to save meal plan'));
    return response.json();
  },

  // Delete a meal plan (soft delete on the server)
  deleteMealPlan: async (id) => {
    const response = await apiFetch(`${API_BASE_URL}/meal-plans/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to delete meal plan'));
  },
};
