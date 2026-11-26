import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealPlanView from './MealPlanView'
import { mealPlanApi, recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { planningRecipes, savedMealPlan } from '../test/fixtures/mealPlans'

vi.mock('../services/api', () => ({
  recipeApi: { getAllRecipes: vi.fn() },
  mealPlanApi: { getMealPlan: vi.fn(), updateMealPlan: vi.fn(), deleteMealPlan: vi.fn() },
}))

const renderView = (state) =>
  renderWithRouter(<MealPlanView />, { path: '/meal-plans/:id', route: '/meal-plans/9', state })

const slot = (day, meal) => {
  const row = screen.getByRole('rowheader', { name: day }).closest('tr')
  return within(row).getAllByRole('cell').find(cell => cell.dataset.meal === meal)
}

const location = () => screen.getByTestId('location')

describe('MealPlanView', () => {
  beforeEach(() => {
    mealPlanApi.getMealPlan.mockResolvedValue(savedMealPlan)
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes)
  })

  it('loads the plan and shows it read-only', async () => {
    renderView()

    expect(screen.getByText('Loading meal plan...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Long weekend' })).toBeInTheDocument()
    expect(mealPlanApi.getMealPlan).toHaveBeenCalledWith('9')
    expect(screen.getByText('Mon, Jun 1 – Tue, Jun 2')).toBeInTheDocument()

    const pancakes = within(slot('Mon, Jun 1', 'Breakfast')).getByRole('link', { name: 'Buttermilk Pancakes' })
    expect(pancakes).toHaveAttribute('href', '/recipe/1')
    expect(pancakes).not.toHaveAttribute('target')
    expect(within(slot('Mon, Jun 1', 'Breakfast')).getByText('30 min · 4 servings')).toBeInTheDocument()
    expect(within(slot('Tue, Jun 2', 'Breakfast')).getByText('No meal')).toBeInTheDocument()
    expect(within(slot('Tue, Jun 2', 'Dinner')).getByRole('link', { name: 'Kung Pao Chicken' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Swap|Remove|Choose/ })).not.toBeInTheDocument()
  })

  it('shows a recipe deleted since saving, without a link', async () => {
    renderView()
    await screen.findByRole('table')

    const dinner = slot('Mon, Jun 1', 'Dinner')
    expect(within(dinner).getByText('Old Tacos (no longer available)')).toBeInTheDocument()
    expect(within(dinner).queryByRole('link')).not.toBeInTheDocument()
    expect(within(dinner).getByText('2 servings')).toBeInTheDocument()
  })

  it('names an unnamed plan after its dates', async () => {
    mealPlanApi.getMealPlan.mockResolvedValue({ ...savedMealPlan, name: null })
    renderView()

    expect(await screen.findByRole('heading', { name: 'Jun 1 – Jun 2' })).toBeInTheDocument()
  })

  it('goes back to the meal plan list', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: '← Back to Meal Plans' }))

    expect(location()).toHaveTextContent('/meal-plans')
  })

  it('confirms a save, once: the message is cleared from the history', async () => {
    renderView({ savedMealPlan: true })

    expect(await screen.findByRole('status')).toHaveTextContent('Meal plan saved.')
    await waitFor(() => expect(location().dataset.state).toBe('null'))
    expect(screen.getByRole('status')).toHaveTextContent('Meal plan saved.')
  })

  it('says nothing on a normal visit', async () => {
    renderView()
    await screen.findByRole('table')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows why a plan did not load, with a way back', async () => {
    const user = userEvent.setup()
    mealPlanApi.getMealPlan.mockRejectedValue(new Error('Failed to load meal plan: Meal plan not found with id: 9'))
    renderView()

    expect(await screen.findByText('Error: Failed to load meal plan: Meal plan not found with id: 9')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Plan' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Back to Meal Plans' }))
    expect(location()).toHaveTextContent('/meal-plans')
  })

  describe('editing', () => {
    async function startEditing() {
      const user = userEvent.setup()
      renderView({ savedMealPlan: true })
      await screen.findByRole('table')
      await user.click(screen.getByRole('button', { name: 'Edit Plan' }))
      await screen.findByRole('table')   // the editor's grid, once its recipes load
      return user
    }

    it('opens the saved plan in the editor, including empty and deleted meals', async () => {
      await startEditing()

      expect(screen.getByRole('heading', { name: 'Edit Meal Plan' })).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()   // the old notice goes
      expect(screen.getByRole('textbox', { name: 'Plan name' })).toHaveValue('Long weekend')
      expect(within(slot('Mon, Jun 1', 'Breakfast')).getByText('Buttermilk Pancakes')).toBeInTheDocument()
      expect(within(slot('Mon, Jun 1', 'Dinner')).getByText('Old Tacos (no longer available)')).toBeInTheDocument()
      expect(within(slot('Tue, Jun 2', 'Breakfast')).getByText('No meal')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete Plan' })).not.toBeInTheDocument()
    })

    it('Save Changes updates the plan and shows what the server saved', async () => {
      const updated = {
        ...savedMealPlan,
        name: 'Longer weekend',
        entries: [
          ...savedMealPlan.entries,
          { id: 34, date: '2026-06-02', mealType: 'BREAKFAST',
            recipe: { id: 2, title: 'Tofu Scramble', totalTimeMinutes: 15, servings: 2, deleted: false } },
        ],
      }
      mealPlanApi.updateMealPlan.mockResolvedValue(updated)
      const user = await startEditing()

      const name = screen.getByRole('textbox', { name: 'Plan name' })
      await user.clear(name)
      await user.type(name, 'Longer weekend')
      await user.click(screen.getByRole('button', { name: 'Choose breakfast for Tuesday, June 2' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Tofu Scramble/ }))
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(mealPlanApi.updateMealPlan).toHaveBeenCalledWith('9', {
        name: 'Longer weekend',
        startDate: '2026-06-01',
        days: 2,
        mealTypes: ['BREAKFAST', 'DINNER'],
        entries: [
          { date: '2026-06-01', mealType: 'BREAKFAST', recipeId: 1 },
          { date: '2026-06-01', mealType: 'DINNER', recipeId: 7 },   // deleted since, but kept
          { date: '2026-06-02', mealType: 'BREAKFAST', recipeId: 2 },
          { date: '2026-06-02', mealType: 'DINNER', recipeId: 5 },
        ],
      })
      expect(await screen.findByRole('heading', { name: 'Longer weekend' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Changes saved.')
      expect(within(slot('Tue, Jun 2', 'Breakfast')).getByRole('link', { name: 'Tofu Scramble' })).toBeInTheDocument()
    })

    it('moving the plan to other dates saves its meals on the new dates', async () => {
      mealPlanApi.updateMealPlan.mockResolvedValue({ ...savedMealPlan, startDate: '2026-06-08', endDate: '2026-06-09' })
      const user = await startEditing()

      fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-06-08' } })
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(mealPlanApi.updateMealPlan).toHaveBeenCalledWith('9', {
        name: 'Long weekend',   // a name the user chose stays
        startDate: '2026-06-08',
        days: 2,
        mealTypes: ['BREAKFAST', 'DINNER'],
        entries: [
          { date: '2026-06-08', mealType: 'BREAKFAST', recipeId: 1 },
          { date: '2026-06-08', mealType: 'DINNER', recipeId: 7 },   // deleted since: it moves too
          { date: '2026-06-09', mealType: 'DINNER', recipeId: 5 },
        ],
      })
      expect(await screen.findByText('Mon, Jun 8 – Tue, Jun 9')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Changes saved.')
    })

    it('removing a meal saves without it', async () => {
      mealPlanApi.updateMealPlan.mockResolvedValue(savedMealPlan)
      const user = await startEditing()

      await user.click(screen.getByRole('button', { name: 'Remove dinner on Tuesday, June 2' }))
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await screen.findByText('Changes saved.')
      expect(mealPlanApi.updateMealPlan.mock.calls[0][1].entries).toEqual([
        { date: '2026-06-01', mealType: 'BREAKFAST', recipeId: 1 },
        { date: '2026-06-01', mealType: 'DINNER', recipeId: 7 },
      ])
    })

    it('when saving fails, stays in the editor and shows why', async () => {
      mealPlanApi.updateMealPlan.mockRejectedValue(new Error('Failed to save meal plan: Recipe 3 does not exist or has been deleted'))
      const user = await startEditing()

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(await screen.findByText('Error: Failed to save meal plan: Recipe 3 does not exist or has been deleted')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Edit Meal Plan' })).toBeInTheDocument()
    })

    it('Cancel with no changes goes straight back', async () => {
      const user = await startEditing()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Long weekend' })).toBeInTheDocument()
      expect(mealPlanApi.updateMealPlan).not.toHaveBeenCalled()
    })

    it('Cancel after changes asks, then keeps the plan as it was saved', async () => {
      const user = await startEditing()

      await user.click(screen.getByRole('button', { name: 'Remove breakfast on Monday, June 1' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await user.click(within(screen.getByRole('alertdialog', { name: 'Discard your changes?' }))
        .getByRole('button', { name: 'Discard changes' }))

      expect(screen.getByRole('heading', { name: 'Long weekend' })).toBeInTheDocument()
      expect(within(slot('Mon, Jun 1', 'Breakfast')).getByRole('link', { name: 'Buttermilk Pancakes' })).toBeInTheDocument()
      expect(mealPlanApi.updateMealPlan).not.toHaveBeenCalled()
    })
  })

  describe('deleting', () => {
    async function openDeleteDialog() {
      const user = userEvent.setup()
      renderView()
      await screen.findByRole('table')
      await user.click(screen.getByRole('button', { name: 'Delete Plan' }))
      return user
    }

    it('asks first, naming the plan', async () => {
      await openDeleteDialog()

      const dialog = screen.getByRole('alertdialog', { name: 'Delete this meal plan?' })
      expect(dialog).toHaveTextContent('“Long weekend” will be removed from your meal plans.')
      expect(mealPlanApi.deleteMealPlan).not.toHaveBeenCalled()
    })

    it('Cancel keeps the plan and returns focus to Delete Plan', async () => {
      const user = await openDeleteDialog()

      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete Plan' })).toHaveFocus()
    })

    it('deletes the plan, then shows the list saying which plan went', async () => {
      let finishDeleting
      mealPlanApi.deleteMealPlan.mockReturnValue(new Promise(resolve => { finishDeleting = resolve }))
      const user = await openDeleteDialog()

      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
      expect(mealPlanApi.deleteMealPlan).toHaveBeenCalledWith('9')
      finishDeleting()
      await waitFor(() => expect(location()).toHaveTextContent(/^\/meal-plans$/))
      expect(JSON.parse(location().dataset.state)).toEqual({ deletedMealPlanName: 'Long weekend' })
    })

    it('when deleting fails, says why in the dialog so it can be retried', async () => {
      mealPlanApi.deleteMealPlan.mockRejectedValue(new Error('Failed to delete meal plan'))
      const user = await openDeleteDialog()

      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('Failed to delete meal plan')
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
      expect(location()).toHaveTextContent('/meal-plans/9')
    })
  })
})

describe('MealPlanView – sharing', () => {
  beforeEach(() => {
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes)
  })

  it('lets a family member edit a plan but not delete it, and says who made it', async () => {
    mealPlanApi.getMealPlan.mockResolvedValue({
      ...savedMealPlan, createdBy: { id: 2, firstName: 'Grace', lastName: 'Hopper' }, canDelete: false,
    })
    renderView()

    expect(await screen.findByText('Created by Grace Hopper')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Plan' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Plan' })).not.toBeInTheDocument()
  })

  it('does not name the creator on their own plan', async () => {
    mealPlanApi.getMealPlan.mockResolvedValue(savedMealPlan)
    renderView()

    expect(await screen.findByRole('button', { name: 'Delete Plan' })).toBeInTheDocument()
    expect(screen.queryByText(/Created by/)).not.toBeInTheDocument()
  })
})

describe('MealPlanView – shopping list', () => {
  it('links to the plan\'s shopping list', async () => {
    mealPlanApi.getMealPlan.mockResolvedValue(savedMealPlan)
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes)
    renderView()

    expect(await screen.findByRole('link', { name: 'Shopping List' })).toHaveAttribute('href', '/meal-plans/9/shopping-list')
  })
})
