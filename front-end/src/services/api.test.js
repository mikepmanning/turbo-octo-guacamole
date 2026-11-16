import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recipeApi } from './api'

// Minimal stand-in for a fetch Response.
const response = (body, { ok = true } = {}) => ({
  ok,
  json: vi.fn(() =>
    body instanceof Error ? Promise.reject(body) : Promise.resolve(body)
  ),
})

describe('recipeApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('GET endpoints', () => {
    it.each([
      { method: 'getAllRecipes', args: [], url: '/api/recipes' },
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
