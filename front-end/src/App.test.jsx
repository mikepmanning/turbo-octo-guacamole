import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { recipeApi, mealPlanApi, authApi, saveSession, clearSession } from './services/api'
import { UNITS } from './test/fixtures/units'
import { savedBurritoBowls } from './test/fixtures/recipes'
import { mealPlanSummaries, savedMealPlan } from './test/fixtures/mealPlans'

// The session helpers stay real (localStorage); the server calls are mocked.
vi.mock('./services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  recipeApi: {
    getAllRecipes: vi.fn(),
    getRecipeById: vi.fn(),
    getUnits: vi.fn(),
  },
  mealPlanApi: {
    getMealPlan: vi.fn(),
    getMealPlans: vi.fn(),
  },
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}))

const ada = { id: 1, email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-12-10' }
const logIn = () => saveSession({ token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: ada })

// App uses BrowserRouter, so set the real URL before rendering.
const renderAt = (path) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('App routes', () => {
  beforeEach(() => {
    logIn()
    authApi.getCurrentUser.mockResolvedValue(ada)
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

    expect(await screen.findByRole('heading', { name: 'Add New Recipe' })).toBeInTheDocument()
    await screen.findAllByRole('option', { name: 'ounce' })
  })

  it('/recipe/:id shows that recipe', async () => {
    renderAt('/recipe/1')

    expect(await screen.findByRole('heading', { name: savedBurritoBowls.title })).toBeInTheDocument()
    expect(recipeApi.getRecipeById).toHaveBeenCalledWith('1')
  })

  it('/meal-plan/new shows the meal plan review page', async () => {
    renderAt('/meal-plan/new')

    // Opened directly there is no generated plan to review.
    expect(await screen.findByRole('heading', { name: 'Meal Plan' })).toBeInTheDocument()
    expect(screen.getByText(/No meal plan in progress/)).toBeInTheDocument()
  })

  it('/meal-plans lists the saved meal plans', async () => {
    renderAt('/meal-plans')

    expect(await screen.findByRole('heading', { name: 'Meal Plans' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Summer week/ })).toHaveAttribute('href', '/meal-plans/12')
  })

  it('/meal-plans/:id shows that saved meal plan', async () => {
    renderAt('/meal-plans/9')

    expect(await screen.findByRole('heading', { name: savedMealPlan.name })).toBeInTheDocument()
    expect(mealPlanApi.getMealPlan).toHaveBeenCalledWith('9')
  })
})

describe('App login', () => {
  beforeEach(() => {
    clearSession()
    recipeApi.getAllRecipes.mockResolvedValue([])
    mealPlanApi.getMealPlans.mockResolvedValue(mealPlanSummaries)
  })

  it('sends a visitor who is not logged in to the login page', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(recipeApi.getAllRecipes).not.toHaveBeenCalled()
  })

  it('/register shows the create account page', () => {
    renderAt('/register')

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('after logging in goes back to the page the visitor asked for', async () => {
    const user = userEvent.setup()
    authApi.login.mockResolvedValue({ token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: ada })
    renderAt('/meal-plans')

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('heading', { name: 'Meal Plans' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/meal-plans')
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(authApi.login).toHaveBeenCalledWith('ada@example.com', 'correct horse')
  })

  it('Log out forgets the session and shows the login page', async () => {
    const user = userEvent.setup()
    logIn()
    authApi.getCurrentUser.mockResolvedValue(ada)
    renderAt('/meal-plans')

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(localStorage.getItem('recipehome.session')).toBeNull()
  })
})
