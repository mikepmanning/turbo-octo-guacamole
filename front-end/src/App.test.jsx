import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { recipeApi, mealPlanApi } from './services/api'
import { UNITS } from './test/fixtures/units'
import { savedBurritoBowls } from './test/fixtures/recipes'
import { mealPlanSummaries, savedMealPlan } from './test/fixtures/mealPlans'

vi.mock('./services/api', () => ({
  recipeApi: {
    getAllRecipes: vi.fn(),
    getRecipeById: vi.fn(),
    getUnits: vi.fn(),
  },
  mealPlanApi: {
    getMealPlan: vi.fn(),
    getMealPlans: vi.fn(),
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
    mealPlanApi.getMealPlan.mockResolvedValue(savedMealPlan)
    mealPlanApi.getMealPlans.mockResolvedValue(mealPlanSummaries)
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

  it('/meal-plan/new shows the meal plan review page', () => {
    renderAt('/meal-plan/new')

    // Opened directly there is no generated plan to review.
    expect(screen.getByRole('heading', { name: 'Meal Plan' })).toBeInTheDocument()
    expect(screen.getByText(/No meal plan in progress/)).toBeInTheDocument()
  })

  it('/meal-plans lists the saved meal plans', async () => {
    renderAt('/meal-plans')

    expect(screen.getByRole('heading', { name: 'Meal Plans' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Summer week/ })).toHaveAttribute('href', '/meal-plans/12')
  })

  it('/meal-plans/:id shows that saved meal plan', async () => {
    renderAt('/meal-plans/9')

    expect(await screen.findByRole('heading', { name: savedMealPlan.name })).toBeInTheDocument()
    expect(mealPlanApi.getMealPlan).toHaveBeenCalledWith('9')
  })
})
