import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealPlanList from './MealPlanList'
import { mealPlanApi, recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { mealPlanSummaries, planningRecipes } from '../test/fixtures/mealPlans'

vi.mock('../services/api', () => ({
  mealPlanApi: { getMealPlans: vi.fn() },
  recipeApi: { getAllRecipes: vi.fn() },
}))

const renderList = (state) => renderWithRouter(<MealPlanList />, { path: '/meal-plans', route: '/meal-plans', state })

const location = () => screen.getByTestId('location')
const cards = () => within(screen.getByRole('list')).getAllByRole('link')

describe('MealPlanList', () => {
  beforeEach(() => {
    // Only the clock: user-event needs real timers.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 15, 9, 0))
    mealPlanApi.getMealPlans.mockResolvedValue(mealPlanSummaries)
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists the saved plans in the order the server gives, each opening its plan', async () => {
    renderList()

    expect(screen.getByText('Loading meal plans...')).toBeInTheDocument()
    await screen.findByRole('list')
    expect(screen.getByRole('heading', { name: 'Meal Plans' })).toBeInTheDocument()
    expect(cards().map(card => card.getAttribute('href'))).toEqual(['/meal-plans/12', '/meal-plans/11', '/meal-plans/9'])
  })

  it('shows each plan\'s name, dates, meals, and whether it is upcoming, current or past', async () => {
    renderList()
    await screen.findByRole('list')
    const [summer, midJune, unnamed] = cards()

    expect(summer).toHaveTextContent('Summer week')
    expect(within(summer).getByText('Upcoming')).toBeInTheDocument()
    expect(within(summer).getByText('Mon, Jun 22 – Sun, Jun 28')).toBeInTheDocument()
    expect(within(summer).getByText('Breakfast · Lunch · Dinner — 21 meals')).toBeInTheDocument()

    expect(within(midJune).getByText('Current')).toBeInTheDocument()
    expect(within(midJune).getByText('Dinner — 1 meal')).toBeInTheDocument()

    expect(unnamed).toHaveTextContent('Jun 1 – Jun 2')   // named after its dates
    expect(within(unnamed).getByText('Past')).toBeInTheDocument()
  })

  it('explains how to make a plan when there are none', async () => {
    mealPlanApi.getMealPlans.mockResolvedValue([])
    renderList()

    expect(await screen.findByText('No meal plans yet. Use “Plan Meals” to make one.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows why the plans did not load, and retries', async () => {
    const user = userEvent.setup()
    mealPlanApi.getMealPlans
      .mockRejectedValueOnce(new Error('Failed to load meal plans'))
      .mockResolvedValueOnce(mealPlanSummaries)
    renderList()

    expect(await screen.findByText('Error: Failed to load meal plans')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await screen.findByRole('list')
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument()
    expect(mealPlanApi.getMealPlans).toHaveBeenCalledTimes(2)
  })

  it('links back to the recipes', async () => {
    renderList()
    await screen.findByRole('list')

    expect(screen.getByRole('link', { name: '← Back to Recipes' })).toHaveAttribute('href', '/')
  })

  it('says which plan was deleted, once: the message is cleared from the history', async () => {
    renderList({ deletedMealPlanName: 'Long weekend' })

    expect(screen.getByRole('status')).toHaveTextContent('“Long weekend” was deleted.')
    await waitFor(() => expect(location().dataset.state).toBe('null'))
    expect(screen.getByRole('status')).toHaveTextContent('“Long weekend” was deleted.')
    await screen.findByRole('list')
  })

  it('says nothing on a normal visit', async () => {
    renderList()
    await screen.findByRole('list')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  describe('planning meals', () => {
    const dialog = () => screen.getByRole('dialog', { name: 'Plan Meals' })

    it('offers Plan Meals from the start, while the plans and recipes load', () => {
      mealPlanApi.getMealPlans.mockReturnValue(new Promise(() => {}))
      recipeApi.getAllRecipes.mockReturnValue(new Promise(() => {}))
      renderList()

      expect(screen.getByRole('button', { name: 'Plan Meals' })).toBeEnabled()
      expect(screen.getByText('Loading meal plans...')).toBeInTheDocument()
    })

    it('opens the dialog with every recipe to plan from; Cancel closes it', async () => {
      const user = userEvent.setup()
      renderList()
      await screen.findByRole('list')

      await user.click(screen.getByRole('button', { name: 'Plan Meals' }))
      expect(within(dialog()).getByRole('checkbox', { name: 'Dinner (2 recipes)' })).toBeChecked()

      await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(1)
    })

    it('opened before the recipes arrive, it shows them as soon as they do', async () => {
      const user = userEvent.setup()
      let finishLoading
      recipeApi.getAllRecipes.mockReturnValue(new Promise(resolve => { finishLoading = resolve }))
      renderList()

      await user.click(screen.getByRole('button', { name: 'Plan Meals' }))
      expect(within(dialog()).getByText('Loading recipes...')).toBeInTheDocument()
      finishLoading(planningRecipes)

      expect(await within(dialog()).findByRole('checkbox', { name: 'Breakfast (2 recipes)' })).toBeChecked()
    })

    it('if the recipes did not load, the dialog says so and Retry loads them again', async () => {
      const user = userEvent.setup()
      recipeApi.getAllRecipes
        .mockRejectedValueOnce(new Error('Failed to fetch recipes'))
        .mockResolvedValueOnce(planningRecipes)
      renderList()
      await screen.findByRole('list')

      await user.click(screen.getByRole('button', { name: 'Plan Meals' }))
      expect(within(dialog()).getByRole('alert')).toHaveTextContent('Failed to fetch recipes')
      await user.click(within(dialog()).getByRole('button', { name: 'Retry' }))

      expect(await within(dialog()).findByRole('checkbox', { name: 'Lunch (2 recipes)' })).toBeInTheDocument()
      expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(2)
    })

    it('Generate opens the new plan for review, unsaved', async () => {
      const user = userEvent.setup()
      renderList()
      await screen.findByRole('list')

      await user.click(screen.getByRole('button', { name: 'Plan Meals' }))
      await user.selectOptions(screen.getByLabelText('Number of days'), '2')
      await user.click(screen.getByRole('button', { name: 'Generate' }))

      expect(location()).toHaveTextContent('/meal-plan/new')
      const { mealPlan } = JSON.parse(location().dataset.state)
      expect(mealPlan).toMatchObject({ startDate: '2026-06-15', days: 2, mealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'] })
      expect(Object.keys(mealPlan.slots)).toHaveLength(6)
    })

    it('can be planned from with no plans saved yet', async () => {
      const user = userEvent.setup()
      mealPlanApi.getMealPlans.mockResolvedValue([])
      renderList()
      await screen.findByText(/No meal plans yet/)

      await user.click(screen.getByRole('button', { name: 'Plan Meals' }))
      expect(dialog()).toBeInTheDocument()
    })
  })
})
