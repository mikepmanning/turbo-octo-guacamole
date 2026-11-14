import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { recipeApi } from './services/api'
import { UNITS } from './test/fixtures/units'
import { savedBurritoBowls } from './test/fixtures/recipes'

vi.mock('./services/api', () => ({
  recipeApi: {
    getAllRecipes: vi.fn(),
    getRecipeById: vi.fn(),
    getUnits: vi.fn(),
  },
}))

// App uses BrowserRouter, so set the real URL before rendering.
const renderAt = (path) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('App routes', () => {
  beforeEach(() => {
    recipeApi.getAllRecipes.mockResolvedValue([])
    recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
    recipeApi.getUnits.mockResolvedValue(UNITS)
  })

  it('/ shows the recipe list', async () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'RecipeHome' })).toBeInTheDocument()
    await screen.findByText(/No recipes found/)
  })

  it('/recipe/new shows the recipe form', async () => {
    renderAt('/recipe/new')

    expect(screen.getByRole('heading', { name: 'Add New Recipe' })).toBeInTheDocument()
    await screen.findAllByRole('option', { name: 'ounce' })
  })

  it('/recipe/:id shows that recipe', async () => {
    renderAt('/recipe/1')

    expect(await screen.findByRole('heading', { name: savedBurritoBowls.title })).toBeInTheDocument()
    expect(recipeApi.getRecipeById).toHaveBeenCalledWith('1')
  })
})
