import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealPlanEditor from './MealPlanEditor'
import { recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { draftPlan, planningRecipes } from '../test/fixtures/mealPlans'

vi.mock('../services/api', () => ({
  recipeApi: { getAllRecipes: vi.fn() },
}))

const ALWAYS_ASK = {
  when: 'always', title: 'Discard this meal plan?', message: 'These meals will be lost.', confirmLabel: 'Discard plan',
}
const ASK_IF_CHANGED = {
  when: 'changed', title: 'Discard your changes?', message: 'The plan will stay as it was.', confirmLabel: 'Discard changes',
}

const renderEditor = (props = {}) => {
  const handlers = { onSave: vi.fn(), onCancel: vi.fn(), onChange: vi.fn() }
  renderWithRouter(
    <MealPlanEditor initialPlan={draftPlan} title="Meal Plan" saveLabel="Save plan" discard={ALWAYS_ASK} {...handlers} {...props} />
  )
  return handlers
}

const loaded = () => screen.findByRole('table', { name: 'Meal plan for Mon, Jun 1 – Tue, Jun 2' })

// The cell for a day's meal, e.g. slot('Mon, Jun 1', 'Dinner').
const slot = (day, meal) => {
  const row = screen.getByRole('rowheader', { name: day }).closest('tr')
  return within(row).getAllByRole('cell').find(cell => cell.dataset.meal === meal)
}

const lastChange = (onChange) => onChange.mock.calls.at(-1)[0]

describe('MealPlanEditor', () => {
  beforeEach(() => {
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes)
  })

  it('shows the plan as a day-by-meal grid once the recipes load', async () => {
    renderEditor()

    expect(screen.getByText('Loading recipes...')).toBeInTheDocument()
    await loaded()
    expect(screen.getByRole('heading', { name: 'Meal Plan' })).toBeInTheDocument()
    expect(screen.getByText('Mon, Jun 1 – Tue, Jun 2')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Plan name' })).toHaveValue('Jun 1 – Jun 2')
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual(['Day', 'Breakfast', 'Dinner'])

    const pancakes = within(slot('Mon, Jun 1', 'Breakfast')).getByRole('link', { name: 'Buttermilk Pancakes' })
    expect(pancakes).toHaveAttribute('href', '/recipe/1')
    expect(pancakes).toHaveAttribute('target', '_blank')
    expect(within(slot('Mon, Jun 1', 'Breakfast')).getByText('30 min · 4 servings')).toBeInTheDocument()
    expect(within(slot('Mon, Jun 1', 'Dinner')).getByText('Kung Pao Chicken')).toBeInTheDocument()
    expect(within(slot('Tue, Jun 2', 'Breakfast')).getByText('Tofu Scramble')).toBeInTheDocument()
    expect(within(slot('Tue, Jun 2', 'Dinner')).getByText('Miso Soup')).toBeInTheDocument()
  })

  it('shows why the recipes did not load, and retries', async () => {
    const user = userEvent.setup()
    recipeApi.getAllRecipes
      .mockRejectedValueOnce(new Error('Failed to fetch recipes'))
      .mockResolvedValueOnce(planningRecipes)
    renderEditor()

    expect(await screen.findByText('Error: Failed to fetch recipes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await loaded()
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument()
    expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(2)
  })

  it('Swap puts a different recipe from the same meal in the slot', async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Swap breakfast on Monday, June 1' }))

    expect(within(slot('Mon, Jun 1', 'Breakfast')).getByText('Tofu Scramble')).toBeInTheDocument()
    expect(screen.getByText('Mon, Jun 1 Breakfast: Tofu Scramble')).toBeInTheDocument()   // announced
    expect(lastChange(onChange).slots['2026-06-01|BREAKFAST']).toBe(2)
  })

  it('Swap is disabled when the meal has no other recipe', async () => {
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes.filter(r => r.id !== 2))
    renderEditor()
    await loaded()

    expect(screen.getByRole('button', { name: 'Swap breakfast on Monday, June 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Swap dinner on Monday, June 1' })).toBeEnabled()
  })

  it('✕ removes a meal; the empty slot can get a random recipe again', async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Remove dinner on Tuesday, June 2' }))

    expect(within(slot('Tue, Jun 2', 'Dinner')).getByText('No meal')).toBeInTheDocument()
    expect(screen.getByText('Removed Dinner on Tue, Jun 2')).toBeInTheDocument()
    expect(lastChange(onChange).slots['2026-06-02|DINNER']).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Add a random dinner on Tuesday, June 2' }))
    const refilled = slot('Tue, Jun 2', 'Dinner')
    expect(within(refilled).queryByText('No meal')).not.toBeInTheDocument()
    expect(['Miso Soup', 'Kung Pao Chicken']).toContain(within(refilled).getByRole('link').textContent)
  })

  it('Choose… opens the picker for that meal and puts the chosen recipe in', async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Choose dinner for Monday, June 1' }))
    const picker = screen.getByRole('dialog', { name: 'Choose dinner for Mon, Jun 1' })
    expect(within(picker).getByRole('button', { name: /Kung Pao Chicken/ })).toHaveAttribute('aria-current', 'true')

    // Any recipe can be chosen, not just dinners.
    await user.click(within(picker).getByRole('checkbox', { name: 'Show all recipes' }))
    await user.click(within(picker).getByRole('button', { name: /Crème Brûlée/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(slot('Mon, Jun 1', 'Dinner')).getByText('Crème Brûlée')).toBeInTheDocument()
    expect(lastChange(onChange).slots['2026-06-01|DINNER']).toBe(6)
  })

  it('cancelling the picker changes nothing', async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Choose breakfast for Tuesday, June 2' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(slot('Tue, Jun 2', 'Breakfast')).getByText('Tofu Scramble')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('says so when a planned recipe is no longer in the collection, by name when it is known', async () => {
    renderEditor({
      initialPlan: { ...draftPlan, slots: { ...draftPlan.slots, '2026-06-01|DINNER': 99, '2026-06-02|DINNER': 98 } },
      knownRecipes: [{ id: 98, title: 'Old Tacos', deleted: true }],
    })
    await loaded()

    expect(within(slot('Mon, Jun 1', 'Dinner')).getByText('Recipe no longer available')).toBeInTheDocument()
    expect(within(slot('Tue, Jun 2', 'Dinner')).getByText('Old Tacos (no longer available)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Swap dinner on Monday, June 1' })).toBeEnabled()
  })

  it('shows the avoided period, and marks recipes also planned in it', async () => {
    const user = userEvent.setup()
    renderEditor({ initialPlan: { ...draftPlan,
      avoid: { from: '2026-05-18', to: '2026-05-31', lastPlanned: { 4: '2026-05-30', 2: '2026-05-20' } } } })
    await loaded()

    expect(screen.getByText('Avoiding recipes planned May 18 – May 31')).toBeInTheDocument()
    expect(within(slot('Tue, Jun 2', 'Dinner')).getByText('Also planned May 30')).toBeInTheDocument()   // Miso Soup
    expect(within(slot('Mon, Jun 1', 'Dinner')).queryByText(/Also planned/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Choose breakfast for Monday, June 1' }))
    const scramble = within(screen.getByRole('dialog')).getByRole('button', { name: /Tofu Scramble/ })
    expect(within(scramble).getByText('Also planned May 20')).toBeInTheDocument()
  })

  it('without an avoided period, shows no such line', async () => {
    renderEditor()
    await loaded()

    expect(screen.queryByText(/Avoiding recipes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Also planned/)).not.toBeInTheDocument()
  })

  describe('ingredients to use up', () => {
    const CHICKEN = { text: 'chicken', mealType: 'DINNER', count: 2, excluded: ['chicken stock'] }
    const checklist = () => screen.getByRole('list', { name: 'Ingredients to use up' })

    it('shows how far each request is met, and marks the meals that use it', async () => {
      renderEditor({ initialPlan: { ...draftPlan, useUp: [CHICKEN] } })
      await loaded()

      // Kung Pao (Jun 1) uses chicken; Miso Soup (Jun 2) only has chicken stock, which was unticked
      expect(within(checklist()).getByRole('listitem')).toHaveTextContent('Chicken: 1 of 2 dinners')
      expect(within(slot('Mon, Jun 1', 'Dinner')).getByText('Uses chicken')).toBeInTheDocument()
      expect(within(slot('Tue, Jun 2', 'Dinner')).queryByText(/Uses/)).not.toBeInTheDocument()
      expect(within(slot('Mon, Jun 1', 'Breakfast')).queryByText(/Uses/)).not.toBeInTheDocument()
    })

    it('ticks a request off when it is met, and updates as meals change', async () => {
      const user = userEvent.setup()
      renderEditor({ initialPlan: { ...draftPlan, useUp: [{ ...CHICKEN, excluded: [] }] } })
      await loaded()
      expect(within(checklist()).getByRole('listitem')).toHaveTextContent('Chicken: 2 of 2 dinners ✓')

      await user.click(screen.getByRole('button', { name: 'Remove dinner on Tuesday, June 2' }))

      expect(within(checklist()).getByRole('listitem')).toHaveTextContent('Chicken: 1 of 2 dinners')
      expect(within(checklist()).getByRole('listitem')).not.toHaveTextContent('✓')
    })

    it('marks the recipes that use it in the picker', async () => {
      const user = userEvent.setup()
      renderEditor({ initialPlan: { ...draftPlan, useUp: [CHICKEN] } })
      await loaded()

      await user.click(screen.getByRole('button', { name: 'Choose dinner for Tuesday, June 2' }))

      const picker = screen.getByRole('dialog')
      expect(within(within(picker).getByRole('button', { name: /Kung Pao/ })).getByText('Uses chicken')).toBeInTheDocument()
      expect(within(within(picker).getByRole('button', { name: /Miso Soup/ })).queryByText(/Uses/)).not.toBeInTheDocument()
    })

    it('has no checklist without requests', async () => {
      renderEditor()
      await loaded()

      expect(screen.queryByRole('list', { name: 'Ingredients to use up' })).not.toBeInTheDocument()
    })
  })

  it('marks a planned recipe that has since been excluded from meal plans, and never swaps one in', async () => {
    const user = userEvent.setup()
    // Miso Soup (Tue dinner) is excluded; Kung Pao is the only other dinner
    recipeApi.getAllRecipes.mockResolvedValue(planningRecipes.map(r => (r.id === 4 ? { ...r, excludedFromMealPlans: true } : r)))
    renderEditor()
    await loaded()

    expect(within(slot('Tue, Jun 2', 'Dinner')).getByText('Excluded from meal plans')).toBeInTheDocument()
    expect(within(slot('Mon, Jun 1', 'Dinner')).queryByText('Excluded from meal plans')).not.toBeInTheDocument()
    // Swapping Monday's dinner has nothing else to use: Miso Soup is excluded
    expect(screen.getByRole('button', { name: 'Swap dinner on Monday, June 1' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Swap dinner on Tuesday, June 2' }))
    expect(within(slot('Tue, Jun 2', 'Dinner')).getByText('Kung Pao Chicken')).toBeInTheDocument()
  })

  describe('changing the start date', () => {
    const startDate = () => screen.getByLabelText('Start date')

    it('moves the plan, each day keeping its meals', async () => {
      const { onChange } = renderEditor()
      await loaded()

      fireEvent.change(startDate(), { target: { value: '2026-06-08' } })

      expect(screen.getByText('Mon, Jun 8 – Tue, Jun 9')).toBeInTheDocument()
      expect(within(slot('Mon, Jun 8', 'Breakfast')).getByText('Buttermilk Pancakes')).toBeInTheDocument()
      expect(within(slot('Tue, Jun 9', 'Dinner')).getByText('Miso Soup')).toBeInTheDocument()
      expect(screen.queryByRole('rowheader', { name: 'Mon, Jun 1' })).not.toBeInTheDocument()
      expect(screen.getByText('Plan moved to Mon, Jun 8 – Tue, Jun 9')).toBeInTheDocument()   // announced
      expect(screen.getByRole('textbox', { name: 'Plan name' })).toHaveValue('Jun 8 – Jun 9')
      expect(lastChange(onChange)).toMatchObject({ startDate: '2026-06-08', name: 'Jun 8 – Jun 9' })
    })

    it('waits for a complete date, and goes back to the plan\'s date if left half typed', async () => {
      const { onChange } = renderEditor()
      await loaded()

      fireEvent.change(startDate(), { target: { value: '' } })   // what the browser reports mid-typing

      expect(startDate()).toHaveValue('')   // left as typed
      expect(screen.getByText('Mon, Jun 1 – Tue, Jun 2')).toBeInTheDocument()
      expect(onChange).not.toHaveBeenCalled()

      fireEvent.blur(startDate())
      expect(startDate()).toHaveValue('2026-06-01')
    })

    it('follows each complete date while typing, ending on the last one', async () => {
      const { onChange } = renderEditor()
      await loaded()

      // Typing the day "30" passes through the 3rd
      for (const value of ['2026-06-03', '2026-06-30']) fireEvent.change(startDate(), { target: { value } })

      expect(startDate()).toHaveValue('2026-06-30')
      expect(screen.getByText('Tue, Jun 30 – Wed, Jul 1')).toBeInTheDocument()
      expect(within(slot('Tue, Jun 30', 'Breakfast')).getByText('Buttermilk Pancakes')).toBeInTheDocument()
      expect(lastChange(onChange).startDate).toBe('2026-06-30')
    })

    it('saves the meals on their new dates', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      renderEditor({ onSave })
      await loaded()

      fireEvent.change(startDate(), { target: { value: '2026-05-31' } })
      await user.click(screen.getByRole('button', { name: 'Save plan' }))

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        startDate: '2026-05-31',
        entries: [
          { date: '2026-05-31', mealType: 'BREAKFAST', recipeId: 1 },
          { date: '2026-05-31', mealType: 'DINNER', recipeId: 5 },
          { date: '2026-06-01', mealType: 'BREAKFAST', recipeId: 2 },
          { date: '2026-06-01', mealType: 'DINNER', recipeId: 4 },
        ],
      }))
    })

    it('counts as a change when asking before discarding', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderEditor({ discard: ASK_IF_CHANGED })
      await loaded()

      fireEvent.change(startDate(), { target: { value: '2026-06-08' } })
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  it('the plan name can be changed', async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    await loaded()

    const name = screen.getByRole('textbox', { name: 'Plan name' })
    await user.clear(name)
    expect(name).toHaveAttribute('placeholder', 'Jun 1 – Jun 2')
    await user.type(name, 'Busy week')

    expect(lastChange(onChange).name).toBe('Busy week')
  })

  it('Save sends the filled meals, showing the saving label meanwhile', async () => {
    const user = userEvent.setup()
    let finishSaving
    const onSave = vi.fn(() => new Promise(resolve => { finishSaving = resolve }))
    renderEditor({ onSave, saveLabel: 'Save Changes', savingLabel: 'Saving changes...' })
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Remove breakfast on Tuesday, June 2' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(screen.getByRole('button', { name: 'Saving changes...' })).toBeDisabled()
    expect(onSave).toHaveBeenCalledWith({
      name: 'Jun 1 – Jun 2',
      startDate: '2026-06-01',
      days: 2,
      mealTypes: ['BREAKFAST', 'DINNER'],
      entries: [
        { date: '2026-06-01', mealType: 'BREAKFAST', recipeId: 1 },
        { date: '2026-06-01', mealType: 'DINNER', recipeId: 5 },
        { date: '2026-06-02', mealType: 'DINNER', recipeId: 4 },
      ],
    })

    finishSaving()
    expect(await screen.findByRole('button', { name: 'Save Changes' })).toBeEnabled()
  })

  it('when saving fails, shows why and keeps the plan to try again', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('Failed to save meal plan: Recipe 5 does not exist or has been deleted'))
    const { onCancel } = renderEditor({ onSave })
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Save plan' }))

    expect(await screen.findByText('Error: Failed to save meal plan: Recipe 5 does not exist or has been deleted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeEnabled()
    expect(within(slot('Mon, Jun 1', 'Dinner')).getByText('Kung Pao Chicken')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cannot save a plan with no meals left', async () => {
    const user = userEvent.setup()
    renderEditor({ initialPlan: { ...draftPlan, days: 1, slots: { '2026-06-01|BREAKFAST': 1, '2026-06-01|DINNER': null } } })
    await screen.findByRole('table', { name: 'Meal plan for Mon, Jun 1' })

    await user.click(screen.getByRole('button', { name: 'Remove breakfast on Monday, June 1' }))

    expect(screen.getByText('Add at least one meal to save the plan.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled()
  })

  describe('cancelling', () => {
    it('asks first when it always should; keeping the plan returns focus to Cancel', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderEditor()
      await loaded()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      const dialog = screen.getByRole('alertdialog', { name: 'Discard this meal plan?' })
      expect(dialog).toHaveTextContent('These meals will be lost.')
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(onCancel).not.toHaveBeenCalled()
    })

    it('discarding calls onCancel', async () => {
      const user = userEvent.setup()
      const { onCancel, onSave } = renderEditor()
      await loaded()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await user.click(screen.getByRole('button', { name: 'Discard plan' }))

      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('the back link asks too, and gets focus back when the plan is kept', async () => {
      const user = userEvent.setup()
      renderEditor({ backLabel: '← Back to Recipes' })
      await loaded()

      await user.click(screen.getByRole('button', { name: '← Back to Recipes' }))
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '← Back to Recipes' })).toHaveFocus()
    })

    it('has no back link unless given one', async () => {
      renderEditor()
      await loaded()

      expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument()
    })

    it('when asking only after changes: leaves straight away if nothing changed', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderEditor({ discard: ASK_IF_CHANGED })
      await loaded()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('when asking only after changes: asks once something changed', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderEditor({ discard: ASK_IF_CHANGED })
      await loaded()

      await user.click(screen.getByRole('button', { name: 'Remove dinner on Monday, June 1' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      const dialog = screen.getByRole('alertdialog', { name: 'Discard your changes?' })
      expect(onCancel).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })
})
