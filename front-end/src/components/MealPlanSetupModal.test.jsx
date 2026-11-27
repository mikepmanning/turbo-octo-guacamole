import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealPlanSetupModal from './MealPlanSetupModal'
import { mealPlanApi } from '../services/api'
import { planningRecipes } from '../test/fixtures/mealPlans'

vi.mock('../services/api', () => ({
  mealPlanApi: { getPlannedMeals: vi.fn() },
}))

const renderModal = (recipes = planningRecipes) => {
  const onClose = vi.fn()
  const onGenerate = vi.fn()
  const view = render(<MealPlanSetupModal recipes={recipes} onClose={onClose} onGenerate={onGenerate} />)
  return { onClose, onGenerate, ...view }
}

const meal = (name) => screen.getByRole('checkbox', { name: new RegExp(`^${name}`) })
const generate = () => screen.getByRole('button', { name: 'Generate' })

describe('MealPlanSetupModal', () => {
  beforeEach(() => {
    // Only the clock: user-event needs real timers. Mon Jun 1 2026, evening (UTC would be Jun 2).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 1, 22, 30))
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is a dialog offering each meal with how many recipes it can use', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Plan Meals' })
    expect(within(dialog).getByRole('checkbox', { name: 'Breakfast (2 recipes)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Lunch (2 recipes)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Dinner (2 recipes)' })).toBeInTheDocument()
  })

  it('a meal with no recipes cannot be chosen, and says why', () => {
    renderModal()

    expect(meal('Snack')).toBeDisabled()
    expect(meal('Snack')).not.toBeChecked()
    expect(screen.getByText('Add a recipe with the “Snack” category first')).toBeInTheDocument()
  })

  it('starts with breakfast, lunch and dinner for 7 days from today (local date)', () => {
    renderModal()

    expect(meal('Breakfast')).toBeChecked()
    expect(meal('Lunch')).toBeChecked()
    expect(meal('Dinner')).toBeChecked()
    expect(screen.getByLabelText('Number of days')).toHaveValue('7')
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-06-01')
    expect(screen.getByText('Mon, Jun 1 – Sun, Jun 7 · 21 meals')).toBeInTheDocument()
    expect(meal('Breakfast')).toHaveFocus()
  })

  it('leaves recipes excluded from meal plans out of the counts, and says how many there are', () => {
    // Tofu Scramble (breakfast) and Crème Brûlée (no meal) are excluded
    renderModal(planningRecipes.map(r => ([2, 6].includes(r.id) ? { ...r, excludedFromMealPlans: true } : r)))

    expect(meal('Breakfast')).toHaveAccessibleName('Breakfast (1 recipe)')
    expect(screen.getByText('2 recipes are excluded from meal plans.')).toBeInTheDocument()
  })

  it('explains a meal whose recipes are all excluded', () => {
    renderModal(planningRecipes.map(r => (r.categories.includes('Breakfast') ? { ...r, excludedFromMealPlans: true } : r)))

    expect(meal('Breakfast')).toBeDisabled()
    expect(screen.getByText('All Breakfast recipes are excluded from meal plans')).toBeInTheDocument()
    expect(screen.getByText('Add a recipe with the “Snack” category first')).toBeInTheDocument()
  })

  it('says nothing about exclusions when there are none', () => {
    renderModal()

    expect(screen.queryByText(/excluded from meal plans/)).not.toBeInTheDocument()
  })

  it('only defaults to meals that have recipes', () => {
    renderModal(planningRecipes.filter(r => !r.categories.includes('Breakfast')))

    expect(meal('Breakfast')).not.toBeChecked()
    expect(meal('Lunch')).toBeChecked()
    expect(meal('Lunch')).toHaveFocus()
  })

  it('the summary follows the choices', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(meal('Lunch'))
    await user.selectOptions(screen.getByLabelText('Number of days'), '3')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-06-30' } })

    expect(screen.getByText('Tue, Jun 30 – Thu, Jul 2 · 6 meals')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Number of days'), '1')
    await user.click(meal('Dinner'))
    expect(screen.getByText('Tue, Jun 30 · 1 meal')).toBeInTheDocument()
  })

  it('needs at least one meal and a start date', async () => {
    const user = userEvent.setup()
    renderModal()

    for (const name of ['Breakfast', 'Lunch', 'Dinner']) await user.click(meal(name))
    expect(screen.getByText('Choose at least one meal.')).toBeInTheDocument()
    expect(generate()).toBeDisabled()

    await user.click(meal('Lunch'))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } })
    expect(screen.getByText('Choose a start date.')).toBeInTheDocument()
    expect(generate()).toBeDisabled()
  })

  it('Generate passes a plan filled from each meal\'s recipes', async () => {
    const user = userEvent.setup()
    const { onGenerate } = renderModal()

    await user.click(meal('Lunch'))
    await user.selectOptions(screen.getByLabelText('Number of days'), '2')
    await user.click(generate())

    expect(onGenerate).toHaveBeenCalledTimes(1)
    const plan = onGenerate.mock.calls[0][0]
    expect(plan).toMatchObject({ name: 'Jun 1 – Jun 2', startDate: '2026-06-01', days: 2, mealTypes: ['BREAKFAST', 'DINNER'] })
    expect([plan.slots['2026-06-01|BREAKFAST'], plan.slots['2026-06-02|BREAKFAST']].sort()).toEqual([1, 2])
    expect([plan.slots['2026-06-01|DINNER'], plan.slots['2026-06-02|DINNER']].sort()).toEqual([4, 5])
  })

  describe('avoiding recent recipes', () => {
    // Meals planned May 18 - May 31 (the 2 weeks before Jun 1): Pancakes (1) twice, Cobb Salad (3) once.
    const recentMeals = [
      { date: '2026-05-20', mealType: 'BREAKFAST', recipeId: 1, mealPlanId: 7, mealPlanName: 'Week of May 18',
        mealPlanStartDate: '2026-05-18', mealPlanDays: 7 },
      { date: '2026-05-26', mealType: 'LUNCH', recipeId: 3, mealPlanId: 8, mealPlanName: null,
        mealPlanStartDate: '2026-05-25', mealPlanDays: 3 },
      { date: '2026-05-27', mealType: 'BREAKFAST', recipeId: 1, mealPlanId: 8, mealPlanName: null,
        mealPlanStartDate: '2026-05-25', mealPlanDays: 3 },
    ]
    const avoidSelect = () => screen.getByLabelText('Avoid recent recipes')

    beforeEach(() => {
      mealPlanApi.getPlannedMeals.mockResolvedValue(recentMeals)
    })

    it("starts at \"Don't avoid\", without checking earlier plans", () => {
      renderModal()

      expect(avoidSelect()).toHaveDisplayValue("Don't avoid")
      expect(screen.getAllByRole('option', { name: /previous|avoid/ }).map(o => o.textContent)).toEqual([
        "Don't avoid", 'Planned in the previous week', 'Planned in the previous 2 weeks', 'Planned in the previous 4 weeks',
      ])
      expect(mealPlanApi.getPlannedMeals).not.toHaveBeenCalled()
    })

    it('checks the meals planned in the period before the start date, and says what it will avoid', async () => {
      const user = userEvent.setup()
      renderModal()

      await user.selectOptions(avoidSelect(), 'Planned in the previous 2 weeks')

      expect(mealPlanApi.getPlannedMeals).toHaveBeenCalledWith('2026-05-18', '2026-05-31')
      expect(await screen.findByText('May 18 – May 31: 2 recipes to avoid, from Week of May 18 and May 25 – May 27'))
        .toBeInTheDocument()
      // Breakfast has 2 recipes and Pancakes was planned recently
      expect(screen.getByText(/Breakfast: 1 new recipe for 7 days,\s+so 1 will be reused from that period/)).toBeInTheDocument()
      expect(screen.getByText(/Lunch: 1 new recipe for 7 days/)).toBeInTheDocument()
      expect(screen.queryByText(/Dinner:/)).not.toBeInTheDocument()
    })

    it('waits for the check before generating', async () => {
      const user = userEvent.setup()
      let finish
      mealPlanApi.getPlannedMeals.mockReturnValue(new Promise(resolve => { finish = resolve }))
      renderModal()

      await user.selectOptions(avoidSelect(), 'Planned in the previous week')

      expect(screen.getByText('Checking earlier meal plans…')).toBeInTheDocument()
      expect(generate()).toBeDisabled()
      finish([])
      expect(await screen.findByText('Nothing planned May 25 – May 31.')).toBeInTheDocument()
      expect(generate()).toBeEnabled()
    })

    it('checks again when the start date changes', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.selectOptions(avoidSelect(), 'Planned in the previous 4 weeks')

      fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-01' } })

      expect(mealPlanApi.getPlannedMeals).toHaveBeenLastCalledWith('2026-06-03', '2026-06-30')
      await screen.findByText(/Jun 3 – Jun 30: 2 recipes to avoid/)
    })

    it('when the check fails, says why, and Retry checks again', async () => {
      const user = userEvent.setup()
      mealPlanApi.getPlannedMeals.mockRejectedValueOnce(new Error('Failed to load planned meals'))
      renderModal()
      await user.selectOptions(avoidSelect(), 'Planned in the previous week')

      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't check earlier meal plans: Failed to load planned meals")
      expect(generate()).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Retry' }))
      expect(await screen.findByText(/May 25 – May 31: 2 recipes to avoid/)).toBeInTheDocument()
      expect(generate()).toBeEnabled()
      expect(mealPlanApi.getPlannedMeals).toHaveBeenCalledTimes(2)
    })

    it('after a failed check, "Don\'t avoid" can plan without it, and choosing a period again re-checks', async () => {
      const user = userEvent.setup()
      let finish
      mealPlanApi.getPlannedMeals
        .mockRejectedValueOnce(new Error('Failed to load planned meals'))
        .mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      renderModal()
      await user.selectOptions(avoidSelect(), 'Planned in the previous week')
      await screen.findByRole('alert')

      await user.selectOptions(avoidSelect(), "Don't avoid")
      expect(generate()).toBeEnabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      await user.selectOptions(avoidSelect(), 'Planned in the previous week')
      expect(screen.getByText('Checking earlier meal plans…')).toBeInTheDocument()   // not the old error
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      finish(recentMeals)
      expect(await screen.findByText(/May 25 – May 31: 2 recipes to avoid/)).toBeInTheDocument()
    })

    it('Generate puts recipes not planned recently first, and keeps the period in the plan', async () => {
      const user = userEvent.setup()
      const { onGenerate } = renderModal()
      await user.click(meal('Lunch'))
      await user.click(meal('Dinner'))
      await user.selectOptions(screen.getByLabelText('Number of days'), '1')
      await user.selectOptions(avoidSelect(), 'Planned in the previous 2 weeks')
      await screen.findByText(/2 recipes to avoid/)

      await user.click(generate())

      const plan = onGenerate.mock.calls[0][0]
      expect(plan.slots).toEqual({ '2026-06-01|BREAKFAST': 2 })   // not Pancakes (1)
      expect(plan.avoid).toEqual({ from: '2026-05-18', to: '2026-05-31', lastPlanned: { 1: '2026-05-27', 3: '2026-05-26' } })
    })

    it('remembers the choice in this browser', async () => {
      const user = userEvent.setup()
      const { unmount } = renderModal()
      await user.selectOptions(avoidSelect(), 'Planned in the previous 2 weeks')
      await screen.findByText(/2 recipes to avoid/)
      unmount()

      renderModal()
      expect(avoidSelect()).toHaveDisplayValue('Planned in the previous 2 weeks')
      expect(await screen.findByText(/2 recipes to avoid/)).toBeInTheDocument()
    })

    it('ignores a remembered value it does not offer', () => {
      window.localStorage.setItem('recipehome.mealPlan.avoidDays', '9')
      renderModal()

      expect(avoidSelect()).toHaveDisplayValue("Don't avoid")
    })

    it('plans without avoiding when the browser blocks storage', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
      renderModal()

      expect(avoidSelect()).toHaveDisplayValue("Don't avoid")
      fireEvent.change(avoidSelect(), { target: { value: '7' } })
      expect(avoidSelect()).toHaveDisplayValue('Planned in the previous week')
    })
  })

  describe('using up ingredients', () => {
    const addIngredient = (user) => user.click(screen.getByRole('button', { name: '+ Add an ingredient' }))
    const ingredient = (n) => screen.getByRole('textbox', { name: `Ingredient ${n}` })
    const howMany = (n) => screen.getByRole('combobox', { name: `How many meals for ingredient ${n}` })
    const mealFor = (n) => screen.getByRole('combobox', { name: `Meal for ingredient ${n}` })
    const matches = () => screen.getAllByRole('checkbox', { name: /\(\d+\)$/ }).filter(box => box.closest('.use-up-matches'))

    it('adds a row for dinner by default, and lists the matching ingredients, all ticked', async () => {
      const user = userEvent.setup()
      renderModal()
      expect(screen.queryByRole('textbox', { name: /Ingredient/ })).not.toBeInTheDocument()

      await addIngredient(user)
      expect(howMany(1)).toHaveValue('1')
      expect(mealFor(1)).toHaveDisplayValue('Dinner')
      await user.type(ingredient(1), 'Chicken')

      expect(matches().map(box => box.parentElement.textContent)).toEqual(['boneless chicken thighs (1)', 'chicken stock (1)'])
      expect(matches().every(box => box.checked)).toBe(true)
      expect(screen.getByText('✓ 2 dinners use it')).toBeInTheDocument()
    })

    it('unticking a match leaves it out, and warns when too few recipes are left', async () => {
      const user = userEvent.setup()
      renderModal()
      await addIngredient(user)
      await user.type(ingredient(1), 'chicken')
      await user.selectOptions(howMany(1), '2')

      await user.click(screen.getByRole('checkbox', { name: 'chicken stock (1)' }))

      expect(screen.getByText('⚠ Only 1 dinner uses “chicken”, so 1 of 2 meals')).toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: 'chicken stock (1)' }))   // ticked again
      expect(screen.getByText('✓ 2 dinners use it')).toBeInTheDocument()
    })

    it('says when no recipes for that meal use it', async () => {
      const user = userEvent.setup()
      renderModal()
      await addIngredient(user)
      await user.selectOptions(mealFor(1), 'Lunch')
      await user.type(ingredient(1), 'salmon')

      expect(screen.getByText('⚠ No lunches use “salmon”')).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Matches' })).not.toBeInTheDocument()
    })

    it('offers only the chosen meals, and at most one meal per day', async () => {
      const user = userEvent.setup()
      renderModal()
      await addIngredient(user)
      await user.selectOptions(howMany(1), '5')

      await user.selectOptions(screen.getByLabelText('Number of days'), '3')
      await user.click(meal('Dinner'))

      expect(within(howMany(1)).getAllByRole('option').map(o => o.textContent)).toEqual(['1', '2', '3'])
      expect(howMany(1)).toHaveValue('3')   // capped to the days
      expect(within(mealFor(1)).getAllByRole('option').map(o => o.textContent)).toEqual(['Breakfast', 'Lunch'])
      expect(mealFor(1)).toHaveDisplayValue('Breakfast')   // dinner isn't planned any more
    })

    it('allows up to 4 ingredients, each removable', async () => {
      const user = userEvent.setup()
      renderModal()
      for (let i = 0; i < 4; i++) await addIngredient(user)
      expect(screen.queryByRole('button', { name: '+ Add an ingredient' })).not.toBeInTheDocument()
      await user.type(ingredient(2), 'tofu')

      await user.click(screen.getByRole('button', { name: 'Remove ingredient 1' }))

      expect(screen.getAllByRole('textbox', { name: /Ingredient/ })).toHaveLength(3)
      expect(ingredient(1)).toHaveValue('tofu')
      expect(screen.getByRole('button', { name: '+ Add an ingredient' })).toBeInTheDocument()
    })

    it('is not offered until a meal is chosen', async () => {
      const user = userEvent.setup()
      renderModal()
      for (const name of ['Breakfast', 'Lunch', 'Dinner']) await user.click(meal(name))

      expect(screen.queryByRole('button', { name: '+ Add an ingredient' })).not.toBeInTheDocument()
    })

    it('Generate places the requested meals first and keeps the requests in the plan', async () => {
      const user = userEvent.setup()
      const { onGenerate } = renderModal()
      await user.click(meal('Breakfast'))
      await user.click(meal('Lunch'))
      await user.selectOptions(screen.getByLabelText('Number of days'), '2')
      await addIngredient(user)
      await user.type(ingredient(1), 'chicken')
      await user.click(screen.getByRole('checkbox', { name: 'chicken stock (1)' }))
      await addIngredient(user)   // left blank: ignored

      await user.click(generate())

      const plan = onGenerate.mock.calls[0][0]
      expect(plan.slots).toEqual({ '2026-06-01|DINNER': 5, '2026-06-02|DINNER': 4 })   // Kung Pao first
      expect(plan.useUp).toEqual([{ text: 'chicken', mealType: 'DINNER', count: 1, excluded: ['chicken stock'] }])
    })
  })

  describe('before the recipes are ready', () => {
    const renderWaiting = (props) => {
      const handlers = { onClose: vi.fn(), onGenerate: vi.fn(), onRetry: vi.fn() }
      const view = render(<MealPlanSetupModal recipes={null} {...handlers} {...props} />)
      return { ...handlers, ...view }
    }

    it('says the recipes are loading, and can be cancelled', async () => {
      const user = userEvent.setup()
      const { onClose } = renderWaiting()

      expect(within(screen.getByRole('dialog', { name: 'Plan Meals' })).getByRole('status')).toHaveTextContent('Loading recipes...')
      expect(screen.queryByRole('button', { name: 'Generate' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('shows the form, with its defaults, once they arrive', () => {
      const { rerender, onClose, onGenerate } = renderWaiting()

      rerender(<MealPlanSetupModal recipes={planningRecipes} onClose={onClose} onGenerate={onGenerate} />)

      expect(meal('Breakfast')).toBeChecked()
      expect(meal('Breakfast')).toHaveFocus()
      expect(screen.getByText('Mon, Jun 1 – Sun, Jun 7 · 21 meals')).toBeInTheDocument()
    })

    it('says why they did not load, with Retry', async () => {
      const user = userEvent.setup()
      const { onRetry } = renderWaiting({ loadError: 'Failed to fetch recipes' })

      expect(screen.getByRole('alert')).toHaveTextContent('Could not load recipes: Failed to fetch recipes')
      await user.click(screen.getByRole('button', { name: 'Retry' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('Escape still closes it', async () => {
      const user = userEvent.setup()
      const { onClose } = renderWaiting()

      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('closes on Cancel, Escape, or a click outside, but not a click inside', async () => {
    const user = userEvent.setup()
    const { onClose, onGenerate } = renderModal()

    await user.click(screen.getByRole('heading', { name: 'Plan Meals' }))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalledTimes(3)
    expect(onGenerate).not.toHaveBeenCalled()
  })
})
