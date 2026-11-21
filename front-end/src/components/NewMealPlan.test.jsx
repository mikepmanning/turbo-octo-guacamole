import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewMealPlan from './NewMealPlan'
import { mealPlanApi, recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { draftPlan, planningRecipes } from '../test/fixtures/mealPlans'

vi.mock('../services/api', () => ({
  recipeApi: { getAllRecipes: vi.fn() },
  mealPlanApi: { createMealPlan: vi.fn() },
}))

const renderPage = (mealPlan = draftPlan) =>
  renderWithRouter(<NewMealPlan />, { path: '/meal-plan/new', route: '/meal-plan/new', state: mealPlan && { mealPlan } })

const loaded = () => screen.findByRole('table')
const location = () => screen.getByTestId('location')
const savedDraft = () => JSON.parse(location().dataset.state).mealPlan

describe('NewMealPlan', () => {
  beforeEach(() => {
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes)
  })

  it('without a plan in progress, says so and links to the Meal Plans page', () => {
    renderPage(null)

    expect(screen.getByRole('heading', { name: 'Meal Plan' })).toBeInTheDocument()
    expect(screen.getByText(/No meal plan in progress/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Meal Plans' })).toHaveAttribute('href', '/meal-plans')
    expect(recipeApi.getAllRecipes).not.toHaveBeenCalled()
  })

  it('shows the generated plan for review', async () => {
    renderPage()
    await loaded()

    expect(screen.getByRole('heading', { name: 'Meal Plan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buttermilk Pancakes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeEnabled()
  })

  it('writes every edit back to the router state, so a refresh keeps it', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Swap breakfast on Monday, June 1' }))
    await user.click(screen.getByRole('button', { name: 'Remove dinner on Tuesday, June 2' }))

    expect(location()).toHaveTextContent('/meal-plan/new')
    expect(savedDraft().slots).toMatchObject({ '2026-06-01|BREAKFAST': 2, '2026-06-02|DINNER': null })
  })

  it('keeps the avoided period through edits', async () => {
    const user = userEvent.setup()
    const avoid = { from: '2026-05-25', to: '2026-05-31', lastPlanned: { 3: '2026-05-26' } }
    renderPage({ ...draftPlan, avoid })
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Remove dinner on Tuesday, June 2' }))

    expect(savedDraft().avoid).toEqual(avoid)
    expect(screen.getByText('Avoiding recipes planned May 25 – May 31')).toBeInTheDocument()
  })

  it('Save plan creates the plan and shows it, replacing the draft in the history', async () => {
    const user = userEvent.setup()
    mealPlanApi.createMealPlan.mockResolvedValue({ id: 9 })
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() => expect(location()).toHaveTextContent('/meal-plans/9'))
    expect(JSON.parse(location().dataset.state)).toEqual({ savedMealPlan: true })
    expect(mealPlanApi.createMealPlan).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Jun 1 – Jun 2', startDate: '2026-06-01', days: 2, mealTypes: ['BREAKFAST', 'DINNER'],
    }))
    expect(mealPlanApi.createMealPlan.mock.calls[0][0].entries).toHaveLength(4)
  })

  it('when saving fails, stays on the plan and shows why', async () => {
    const user = userEvent.setup()
    mealPlanApi.createMealPlan.mockRejectedValue(new Error('Failed to save meal plan'))
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Save plan' }))

    expect(await screen.findByText('Error: Failed to save meal plan')).toBeInTheDocument()
    expect(location()).toHaveTextContent('/meal-plan/new')
  })

  it('discarding, after asking, returns to the Meal Plans page without saving', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: '← Back to Meal Plans' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Discard this meal plan?' })
    await user.click(within(dialog).getByRole('button', { name: 'Discard plan' }))

    expect(location()).toHaveTextContent(/^\/meal-plans$/)
    expect(mealPlanApi.createMealPlan).not.toHaveBeenCalled()
  })
})
