import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  recipeApi, mealPlanApi, authApi, familyApi, shoppingListApi, getSession, saveSession, clearSession, SESSION_KEY, SESSION_EXPIRED_EVENT,
  clearRecipeCache, RECIPE_CACHE_MS,
} from './api'

// Minimal stand-in for a fetch Response.
const response = (body, { ok = true } = {}) => ({
  ok,
  json: vi.fn(() =>
    body instanceof Error ? Promise.reject(body) : Promise.resolve(body)
  ),
})

// The recipe list is cached between calls: start every test without it.
beforeEach(() => clearRecipeCache())

describe('recipeApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('GET endpoints', () => {
    it.each([
      { method: 'getAllRecipes', args: [], url: '/api/recipes?view=summary' },
      { method: 'getRecipeById', args: [5], url: '/api/recipes/5' },
      { method: 'searchRecipes', args: ['mac & cheese'], url: '/api/recipes/search?title=mac%20%26%20cheese' },
      { method: 'getRecipesByCategory', args: ['Side Dish'], url: '/api/recipes/category/Side%20Dish' },
      { method: 'getUnits', args: [], url: '/api/units' },
    ])('$method calls $url and returns the JSON body', async ({ method, args, url }) => {
      fetch.mockResolvedValue(response({ data: method }))

      await expect(recipeApi[method](...args)).resolves.toEqual({ data: method })
      expect(fetch).toHaveBeenCalledWith(url)
    })

    it.each([
      { method: 'getAllRecipes', args: [], message: 'Failed to fetch recipes' },
      { method: 'getRecipeById', args: [5], message: 'Failed to fetch recipe' },
      { method: 'searchRecipes', args: ['x'], message: 'Failed to search recipes' },
      { method: 'getRecipesByCategory', args: ['x'], message: 'Failed to fetch recipes by category' },
      { method: 'getUnits', args: [], message: 'Failed to fetch units' },
    ])('$method throws "$message" when the response is not ok', async ({ method, args, message }) => {
      fetch.mockResolvedValue(response({}, { ok: false }))

      await expect(recipeApi[method](...args)).rejects.toThrow(message)
    })
  })

  describe('createRecipe', () => {
    it('POSTs the recipe as JSON and returns the created recipe', async () => {
      fetch.mockResolvedValue(response({ id: 7 }))

      await expect(recipeApi.createRecipe({ title: 'Tacos' })).resolves.toEqual({ id: 7 })
      expect(fetch).toHaveBeenCalledWith('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Tacos' }),
      })
    })

    it('throws when the response is not ok', async () => {
      fetch.mockResolvedValue(response({}, { ok: false }))

      await expect(recipeApi.createRecipe({})).rejects.toThrow('Failed to create recipe')
    })
  })

  describe('updateRecipe', () => {
    it('PUTs the recipe as JSON to /api/recipes/:id', async () => {
      fetch.mockResolvedValue(response({ id: 3, title: 'New' }))

      await expect(recipeApi.updateRecipe(3, { title: 'New' })).resolves.toEqual({ id: 3, title: 'New' })
      expect(fetch).toHaveBeenCalledWith('/api/recipes/3', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New' }),
      })
    })

    it('throws when the response is not ok', async () => {
      fetch.mockResolvedValue(response({}, { ok: false }))

      await expect(recipeApi.updateRecipe(3, {})).rejects.toThrow('Failed to update recipe')
    })

    it.each([
      { desc: 'an error', body: { error: 'Recipe not found with id: 3' },
        message: 'Failed to update recipe: Recipe not found with id: 3' },
      { desc: 'field errors', body: { 'ingredients[0].name': 'Ingredient name is required', title: 'Recipe title is required' },
        message: 'Failed to update recipe: Ingredient name is required; Recipe title is required' },
      { desc: 'a body that is not JSON', body: new Error('not JSON'), message: 'Failed to update recipe' },
      { desc: 'an empty body', body: null, message: 'Failed to update recipe' },
    ])('uses the server\'s explanation when it sends $desc', async ({ body, message }) => {
      fetch.mockResolvedValue(response(body, { ok: false }))

      await expect(recipeApi.updateRecipe(3, {})).rejects.toThrow(new Error(message))
    })
  })

  describe('deleteRecipe', () => {
    it('sends DELETE and does not read a response body', async () => {
      const res = response(null)
      fetch.mockResolvedValue(res)

      await expect(recipeApi.deleteRecipe(9)).resolves.toBeUndefined()
      expect(fetch).toHaveBeenCalledWith('/api/recipes/9', { method: 'DELETE' })
      expect(res.json).not.toHaveBeenCalled()
    })

    it('throws when the response is not ok', async () => {
      fetch.mockResolvedValue(response(null, { ok: false }))

      await expect(recipeApi.deleteRecipe(9)).rejects.toThrow('Failed to delete recipe')
    })

    it('includes the server\'s explanation when it sends one', async () => {
      fetch.mockResolvedValue(response({ error: 'An unexpected error occurred: connection refused' }, { ok: false }))

      await expect(recipeApi.deleteRecipe(9)).rejects
        .toThrow(new Error('Failed to delete recipe: An unexpected error occurred: connection refused'))
    })
  })

  describe('deleteRecipes', () => {
    it('POSTs the ids to /api/recipes/bulk-delete and returns what was deleted', async () => {
      fetch.mockResolvedValue(response({ deletedIds: [1, 3] }))

      await expect(recipeApi.deleteRecipes([1, 2, 3])).resolves.toEqual({ deletedIds: [1, 3] })
      expect(fetch).toHaveBeenCalledWith('/api/recipes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1, 2, 3] }),
      })
    })

    it('throws with the server\'s explanation when the response is not ok', async () => {
      fetch.mockResolvedValue(response({ ids: 'Delete at most 100 recipes at a time' }, { ok: false }))

      await expect(recipeApi.deleteRecipes([])).rejects
        .toThrow(new Error('Failed to delete recipes: Delete at most 100 recipes at a time'))
    })
  })

  describe('setExcludedFromMealPlans', () => {
    it('PUTs the ids and the choice to /api/recipes/meal-plan-exclusion', async () => {
      fetch.mockResolvedValue(response({ updatedIds: [1] }))

      await expect(recipeApi.setExcludedFromMealPlans([1, 2], true)).resolves.toEqual({ updatedIds: [1] })
      expect(fetch).toHaveBeenCalledWith('/api/recipes/meal-plan-exclusion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1, 2], excluded: true }),
      })
    })

    it('throws with the server\'s explanation when the response is not ok', async () => {
      fetch.mockResolvedValue(response({ ids: 'Select at least one recipe' }, { ok: false }))

      await expect(recipeApi.setExcludedFromMealPlans([], false)).rejects
        .toThrow(new Error('Failed to update meal plan settings: Select at least one recipe'))
    })
  })

  describe('importRecipeFromUrl', () => {
    it('URL-encodes the recipe link and returns the imported recipe', async () => {
      fetch.mockResolvedValue(response({ title: 'Burrito Bowls' }))

      await expect(recipeApi.importRecipeFromUrl('https://x.com/a b?c=1'))
        .resolves.toEqual({ title: 'Burrito Bowls' })
      expect(fetch).toHaveBeenCalledWith(
        '/api/recipes/import?url=https%3A%2F%2Fx.com%2Fa%20b%3Fc%3D1',
        { method: 'GET', headers: { Accept: 'application/json' } }
      )
    })

    it('uses the message from the error body when there is one', async () => {
      fetch.mockResolvedValue(response({ message: 'Site blocked the request' }, { ok: false }))

      await expect(recipeApi.importRecipeFromUrl('https://x.com'))
        .rejects.toThrow('Site blocked the request')
    })

    it('falls back to a generic message when the error body is not JSON', async () => {
      fetch.mockResolvedValue(response(new SyntaxError('Unexpected token <'), { ok: false }))

      await expect(recipeApi.importRecipeFromUrl('https://x.com'))
        .rejects.toThrow('Failed to import recipe')
    })
  })
})

describe('mealPlanApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('createMealPlan', () => {
    const plan = { startDate: '2026-06-01', days: 1, mealTypes: ['LUNCH'], entries: [] }

    it('POSTs the plan as JSON to /api/meal-plans and returns the saved plan', async () => {
      fetch.mockResolvedValue(response({ id: 4 }))

      await expect(mealPlanApi.createMealPlan(plan)).resolves.toEqual({ id: 4 })
      expect(fetch).toHaveBeenCalledWith('/api/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      })
    })

    it('throws with the server\'s explanation when the response is not ok', async () => {
      fetch.mockResolvedValue(response({ error: 'Recipe 9 does not exist or has been deleted' }, { ok: false }))

      await expect(mealPlanApi.createMealPlan(plan)).rejects
        .toThrow(new Error('Failed to save meal plan: Recipe 9 does not exist or has been deleted'))
    })
  })

  describe('getMealPlans', () => {
    it('GETs /api/meal-plans and returns the list', async () => {
      fetch.mockResolvedValue(response([{ id: 4 }]))

      await expect(mealPlanApi.getMealPlans()).resolves.toEqual([{ id: 4 }])
      expect(fetch).toHaveBeenCalledWith('/api/meal-plans')
    })

    it('throws when the response is not ok', async () => {
      fetch.mockResolvedValue(response(new SyntaxError('Unexpected token <'), { ok: false }))

      await expect(mealPlanApi.getMealPlans()).rejects.toThrow(new Error('Failed to load meal plans'))
    })
  })

  describe('getPlannedMeals', () => {
    it('GETs /api/meal-plans/meals for the date range and returns the meals', async () => {
      fetch.mockResolvedValue(response([{ recipeId: 4 }]))

      await expect(mealPlanApi.getPlannedMeals('2026-11-16', '2026-11-29')).resolves.toEqual([{ recipeId: 4 }])
      expect(fetch).toHaveBeenCalledWith('/api/meal-plans/meals?from=2026-11-16&to=2026-11-29')
    })

    it('throws with the server\'s explanation when the response is not ok', async () => {
      fetch.mockResolvedValue(response({ error: 'The date range can be at most 366 days' }, { ok: false }))

      await expect(mealPlanApi.getPlannedMeals('2020-01-01', '2026-11-29')).rejects
        .toThrow(new Error('Failed to load planned meals: The date range can be at most 366 days'))
    })
  })

  describe('updateMealPlan', () => {
    const plan = { startDate: '2026-06-01', days: 1, mealTypes: ['LUNCH'], entries: [] }

    it('PUTs the plan as JSON to /api/meal-plans/:id and returns the updated plan', async () => {
      fetch.mockResolvedValue(response({ id: 4, name: 'Renamed' }))

      await expect(mealPlanApi.updateMealPlan(4, plan)).resolves.toEqual({ id: 4, name: 'Renamed' })
      expect(fetch).toHaveBeenCalledWith('/api/meal-plans/4', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      })
    })

    it('throws with the server\'s explanation when the response is not ok', async () => {
      fetch.mockResolvedValue(response({ error: 'Meal plan not found with id: 4' }, { ok: false }))

      await expect(mealPlanApi.updateMealPlan(4, plan)).rejects
        .toThrow(new Error('Failed to save meal plan: Meal plan not found with id: 4'))
    })
  })

  describe('deleteMealPlan', () => {
    it('sends DELETE and does not read a response body', async () => {
      const ok = response(null)
      fetch.mockResolvedValue(ok)

      await expect(mealPlanApi.deleteMealPlan(4)).resolves.toBeUndefined()
      expect(fetch).toHaveBeenCalledWith('/api/meal-plans/4', { method: 'DELETE' })
      expect(ok.json).not.toHaveBeenCalled()
    })

    it('throws when the response is not ok', async () => {
      fetch.mockResolvedValue(response({ error: 'Database unavailable' }, { ok: false }))

      await expect(mealPlanApi.deleteMealPlan(4)).rejects
        .toThrow(new Error('Failed to delete meal plan: Database unavailable'))
    })
  })

  describe('getMealPlan', () => {
    it('GETs /api/meal-plans/:id and returns the plan', async () => {
      fetch.mockResolvedValue(response({ id: 4 }))

      await expect(mealPlanApi.getMealPlan(4)).resolves.toEqual({ id: 4 })
      expect(fetch).toHaveBeenCalledWith('/api/meal-plans/4')
    })

    it('throws with the server\'s explanation when the response is not ok', async () => {
      fetch.mockResolvedValue(response({ error: 'Meal plan not found with id: 4' }, { ok: false }))

      await expect(mealPlanApi.getMealPlan(4)).rejects
        .toThrow(new Error('Failed to load meal plan: Meal plan not found with id: 4'))
    })
  })
})

describe('login session', () => {
  const session = { token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: { firstName: 'Ada' } }

  beforeEach(() => {
    clearSession()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('saves, reads and clears the session in localStorage', () => {
    expect(getSession()).toBeNull()
    saveSession(session)
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(session)
    expect(getSession()).toEqual(session)
    clearSession()
    expect(getSession()).toBeNull()
  })

  it('treats an expired session as none and removes it', () => {
    saveSession({ ...session, expiresAt: '2000-01-01T00:00:00Z' })
    expect(getSession()).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('ignores a stored value that is not a session', () => {
    localStorage.setItem(SESSION_KEY, 'not json')
    expect(getSession()).toBeNull()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: {} }))
    expect(getSession()).toBeNull()
  })

  it('sends the token with every API request, keeping other headers', async () => {
    saveSession(session)
    fetch.mockResolvedValue(response({ id: 7 }))

    await recipeApi.getAllRecipes()
    expect(fetch).toHaveBeenCalledWith('/api/recipes?view=summary', { headers: { Authorization: 'Bearer tok' } })

    await recipeApi.createRecipe({ title: 'Tacos' })
    expect(fetch).toHaveBeenLastCalledWith('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ title: 'Tacos' }),
    })
  })

  it('forgets the session and tells the app when the server rejects the token', async () => {
    saveSession(session)
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    fetch.mockResolvedValue({ ...response({ error: 'Please log in' }, { ok: false }), status: 401 })

    await expect(mealPlanApi.getMealPlans()).rejects.toThrow('Failed to load meal plans: Please log in')

    expect(getSession()).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('a 401 without a session does not fire the event', async () => {
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    fetch.mockResolvedValue({ ...response({}, { ok: false }), status: 401 })

    await expect(recipeApi.getAllRecipes()).rejects.toThrow()

    expect(expired).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })
})

describe('authApi', () => {
  const result = { token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: { id: 1 } }

  beforeEach(() => {
    clearSession()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('login POSTs the email and password and returns the session', async () => {
    fetch.mockResolvedValue(response(result))

    await expect(authApi.login('ada@example.com', 'pw')).resolves.toEqual(result)
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', password: 'pw' }),
    })
  })

  it('login rejects with the server\'s message', async () => {
    fetch.mockResolvedValue(response({ error: 'Invalid email or password' }, { ok: false }))

    await expect(authApi.login('a', 'b')).rejects.toThrow('Invalid email or password')
  })

  it('login falls back to a general message', async () => {
    fetch.mockResolvedValue(response(new Error('not json'), { ok: false }))

    await expect(authApi.login('a', 'b')).rejects.toThrow('Could not log in')
  })

  it('register POSTs the account and returns the session', async () => {
    fetch.mockResolvedValue(response(result))
    const account = { email: 'ada@example.com', password: 'pw', firstName: 'Ada', lastName: 'L', dateOfBirth: '1990-12-10' }

    await expect(authApi.register(account)).resolves.toEqual(result)
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(account),
    }))
  })

  it('register rejects with the field errors the server sent', async () => {
    fetch.mockResolvedValue(response({ email: 'Enter a valid email address' }, { ok: false }))

    const error = await authApi.register({}).catch(e => e)

    expect(error.message).toBe('Enter a valid email address')
    expect(error.fieldErrors).toEqual({ email: 'Enter a valid email address' })
  })

  it('getCurrentUser GETs /api/auth/me with the token', async () => {
    saveSession(result)
    fetch.mockResolvedValue(response({ id: 1, firstName: 'Ada' }))

    await expect(authApi.getCurrentUser()).resolves.toEqual({ id: 1, firstName: 'Ada' })
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', { headers: { Authorization: 'Bearer tok' } })
  })

  it('getCurrentUser throws when the response is not ok', async () => {
    fetch.mockResolvedValue(response({}, { ok: false }))

    await expect(authApi.getCurrentUser()).rejects.toThrow('Failed to load your account')
  })
})

describe('authApi account changes', () => {
  beforeEach(() => {
    saveSession({ token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('updateProfile PUTs the details to /api/auth/me with the token', async () => {
    const profile = { firstName: 'Ada', lastName: 'L', email: 'ada@example.com', dateOfBirth: '1990-12-10' }
    fetch.mockResolvedValue(response({ id: 1, ...profile }))

    await expect(authApi.updateProfile(profile)).resolves.toEqual({ id: 1, ...profile })
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify(profile),
    })
  })

  it('updateProfile rejects with the server\'s message', async () => {
    fetch.mockResolvedValue(response({ error: 'An account with this email already exists' }, { ok: false }))

    await expect(authApi.updateProfile({})).rejects.toThrow('An account with this email already exists')
  })

  it('changePassword PUTs both passwords to /api/auth/me/password', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204 })

    await expect(authApi.changePassword('old password', 'new password')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/auth/me/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ currentPassword: 'old password', newPassword: 'new password' }),
    })
  })

  it('a wrong current password is a field error and keeps the user logged in', async () => {
    fetch.mockResolvedValue({
      ...response({ currentPassword: 'Current password is incorrect' }, { ok: false }), status: 400,
    })

    const error = await authApi.changePassword('wrong', 'new password').catch(e => e)

    expect(error.fieldErrors).toEqual({ currentPassword: 'Current password is incorrect' })
    expect(getSession()).not.toBeNull()
  })

  it('changePassword falls back to a general message', async () => {
    fetch.mockResolvedValue(response(new Error('not json'), { ok: false }))

    await expect(authApi.changePassword('a', 'b')).rejects.toThrow('Could not change your password')
  })
})

describe('familyApi', () => {
  const family = { id: 7, name: 'The Lovelaces' }
  const json = { 'Content-Type': 'application/json', Authorization: 'Bearer tok' }
  const auth = { Authorization: 'Bearer tok' }

  beforeEach(() => {
    saveSession({ token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn())
  })

  it.each([
    { call: () => familyApi.getMyFamily(), url: '/api/family', init: { method: 'GET', headers: auth } },
    { call: () => familyApi.createFamily('The Lovelaces'), url: '/api/family',
      init: { method: 'POST', headers: json, body: JSON.stringify({ name: 'The Lovelaces' }) } },
    { call: () => familyApi.renameFamily('Team'), url: '/api/family',
      init: { method: 'PUT', headers: json, body: JSON.stringify({ name: 'Team' }) } },
    { call: () => familyApi.newInviteCode(), url: '/api/family/invite-code', init: { method: 'POST', headers: auth } },
    { call: () => familyApi.revokeInviteCode(), url: '/api/family/invite-code', init: { method: 'DELETE', headers: auth } },
    { call: () => familyApi.joinFamily('abcd-2345'), url: '/api/family/join',
      init: { method: 'POST', headers: json, body: JSON.stringify({ code: 'abcd-2345' }) } },
    { call: () => familyApi.removeMember(2), url: '/api/family/members/2', init: { method: 'DELETE', headers: auth } },
    { call: () => familyApi.makeOwner(2), url: '/api/family/members/2/make-owner', init: { method: 'POST', headers: auth } },
  ])('$url $init.method returns the family', async ({ call, url, init }) => {
    fetch.mockResolvedValue({ ...response(family), status: 200 })

    await expect(call()).resolves.toEqual(family)
    expect(fetch).toHaveBeenCalledWith(url, init)
  })

  it.each([
    { name: 'getMyFamily (not in a family)', call: () => familyApi.getMyFamily() },
    { name: 'leaveFamily', call: () => familyApi.leaveFamily() },
    { name: 'deleteFamily', call: () => familyApi.deleteFamily() },
  ])('$name resolves to null on 204', async ({ call }) => {
    fetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() })

    await expect(call()).resolves.toBeNull()
  })

  it('rejects with the server\'s message', async () => {
    fetch.mockResolvedValue({ ...response({ error: 'Only the family owner can do that' }, { ok: false }), status: 403 })

    await expect(familyApi.revokeInviteCode()).rejects.toThrow('Only the family owner can do that')
    expect(getSession()).not.toBeNull()
  })

  it('falls back to a general message', async () => {
    fetch.mockResolvedValue(response(new Error('not json'), { ok: false }))

    await expect(familyApi.joinFamily('X')).rejects.toThrow('Could not join the family')
  })
})

describe('shoppingListApi', () => {
  const list = { mealPlanId: 9, items: [] }
  const auth = { Authorization: 'Bearer tok' }

  beforeEach(() => {
    saveSession({ token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('GETs the list of a plan', async () => {
    fetch.mockResolvedValue({ ...response(list), status: 200 })

    await expect(shoppingListApi.getShoppingList(9)).resolves.toEqual(list)
    expect(fetch).toHaveBeenCalledWith('/api/meal-plans/9/shopping-list', { method: 'GET', headers: auth })
  })

  it('resolves to null when the plan has no list yet (204)', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() })

    await expect(shoppingListApi.getShoppingList(9)).resolves.toBeNull()
  })

  it('POSTs to make the list', async () => {
    fetch.mockResolvedValue({ ...response(list), status: 200 })

    await expect(shoppingListApi.generateShoppingList(9)).resolves.toEqual(list)
    expect(fetch).toHaveBeenCalledWith('/api/meal-plans/9/shopping-list', { method: 'POST', headers: auth })
  })

  it('PUTs a tick and resolves to the whole list', async () => {
    fetch.mockResolvedValue({ ...response(list), status: 200 })

    await expect(shoppingListApi.setItemChecked(9, 101, true)).resolves.toEqual(list)
    expect(fetch).toHaveBeenCalledWith('/api/meal-plans/9/shopping-list/items/101', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ checked: true }),
    })
  })

  it('rejects with the server\'s message', async () => {
    fetch.mockResolvedValue({ ...response({ error: "That item isn't on this shopping list" }, { ok: false }), status: 404 })

    await expect(shoppingListApi.setItemChecked(9, 1, true)).rejects.toThrow("That item isn't on this shopping list")
  })
})

describe('shoppingListApi.getShoppingLists', () => {
  beforeEach(() => {
    saveSession({ token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('GETs every list the user can see', async () => {
    fetch.mockResolvedValue({ ...response([{ mealPlanId: 9 }]), status: 200 })

    await expect(shoppingListApi.getShoppingLists()).resolves.toEqual([{ mealPlanId: 9 }])
    expect(fetch).toHaveBeenCalledWith('/api/shopping-lists', { method: 'GET', headers: { Authorization: 'Bearer tok' } })
  })
})

describe('recipe list cache', () => {
  const session = { token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: { firstName: 'Ada' } }

  beforeEach(() => {
    clearSession()
    saveSession(session)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response([{ id: 1 }]))))
  })

  afterEach(() => {
    vi.useRealTimers()
    clearSession()
  })

  it('shares one download between calls', async () => {
    const [first, second] = await Promise.all([recipeApi.getAllRecipes(), recipeApi.getAllRecipes()])
    const third = await recipeApi.getAllRecipes()

    expect(first).toEqual([{ id: 1 }])
    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('loads again once it has expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await recipeApi.getAllRecipes()
    vi.setSystemTime(Date.now() + RECIPE_CACHE_MS - 1)
    await recipeApi.getAllRecipes()
    expect(fetch).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + 1)
    await recipeApi.getAllRecipes()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('is dropped when a change is saved', async () => {
    await recipeApi.getAllRecipes()
    await recipeApi.setExcludedFromMealPlans([1], true)
    await recipeApi.getAllRecipes()

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/recipes?view=summary', '/api/recipes/meal-plan-exclusion', '/api/recipes?view=summary',
    ])
  })

  it('is kept after a failed change', async () => {
    await recipeApi.getAllRecipes()
    fetch.mockResolvedValueOnce(response({}, { ok: false }))
    await expect(recipeApi.deleteRecipe(1)).rejects.toThrow()
    await recipeApi.getAllRecipes()

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not keep a failed load', async () => {
    fetch.mockResolvedValueOnce(response({}, { ok: false }))
    await expect(recipeApi.getAllRecipes()).rejects.toThrow('Failed to fetch recipes')

    await expect(recipeApi.getAllRecipes()).resolves.toEqual([{ id: 1 }])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('belongs to the logged-in user', async () => {
    await recipeApi.getAllRecipes()
    saveSession({ ...session, token: 'someone-else' })
    await recipeApi.getAllRecipes()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenLastCalledWith('/api/recipes?view=summary', { headers: { Authorization: 'Bearer someone-else' } })
  })
})
