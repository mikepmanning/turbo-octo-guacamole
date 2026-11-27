import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipePickerDialog from './RecipePickerDialog'
import { planningRecipes } from '../test/fixtures/mealPlans'

const renderPicker = ({ mealType = 'DINNER', currentId = 5, recipes = planningRecipes, lastPlanned } = {}) => {
  const onPick = vi.fn()
  const onCancel = vi.fn()
  render(
    <RecipePickerDialog
      title="Choose dinner for Mon, Jun 1"
      mealType={mealType}
      recipes={recipes}
      currentId={currentId}
      lastPlanned={lastPlanned}
      onPick={onPick}
      onCancel={onCancel}
    />
  )
  return { onPick, onCancel }
}

const options = () => within(screen.getByRole('list')).getAllByRole('button')
const optionTitles = () => options().map(option => option.querySelector('.picker-title').textContent)

describe('RecipePickerDialog', () => {
  it('lists the meal\'s recipes by title, marking the current one', () => {
    renderPicker()

    expect(screen.getByRole('dialog', { name: 'Choose dinner for Mon, Jun 1' })).toBeInTheDocument()
    expect(optionTitles()).toEqual(['Kung Pao Chicken', 'Miso Soup'])
    const current = screen.getByRole('button', { name: /Kung Pao Chicken/ })
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(within(current).getByText('Current')).toBeInTheDocument()
    expect(within(current).getByText('25 min · 4 servings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Miso Soup/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toHaveFocus()
  })

  it('searches like the recipe list, and says when nothing matches', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.type(screen.getByRole('searchbox'), 'soup')
    expect(optionTitles()).toEqual(['Miso Soup'])

    await user.type(screen.getByRole('searchbox'), 'xyz')
    expect(screen.getByRole('status')).toHaveTextContent('No recipes match your search.')
  })

  it('"Show all recipes" includes recipes from other categories', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('checkbox', { name: 'Show all recipes' }))
    expect(optionTitles()).toEqual([
      'Buttermilk Pancakes', 'Cobb Salad', 'Crème Brûlée', 'Kung Pao Chicken', 'Miso Soup', 'Tofu Scramble',
    ])

    await user.type(screen.getByRole('searchbox'), 'creme')
    expect(optionTitles()).toEqual(['Crème Brûlée'])
  })

  it('explains an empty category and how to choose anyway', async () => {
    const user = userEvent.setup()
    renderPicker({ mealType: 'SNACK', currentId: null })

    expect(screen.getByRole('status')).toHaveTextContent(
      'No recipes have the “Snack” category yet. Show all recipes to choose any recipe.')

    await user.click(screen.getByRole('checkbox', { name: 'Show all recipes' }))
    expect(options()).toHaveLength(6)
  })

  it('hides recipes excluded from meal plans, unless showing all, where they are marked', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker({ recipes: planningRecipes.map(r => (r.id === 4 ? { ...r, excludedFromMealPlans: true } : r)) })
    expect(optionTitles()).toEqual(['Kung Pao Chicken'])

    await user.click(screen.getByRole('checkbox', { name: 'Show all recipes' }))

    const miso = screen.getByRole('button', { name: /Miso Soup/ })
    expect(within(miso).getByText('Excluded from meal plans')).toBeInTheDocument()
    await user.click(miso)
    expect(onPick).toHaveBeenCalledWith(4)   // a deliberate choice is allowed
  })

  it('marks recipes planned recently, which can still be picked', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker({ lastPlanned: { 4: '2026-05-30' } })

    const miso = screen.getByRole('button', { name: /Miso Soup/ })
    expect(within(miso).getByText('Also planned May 30')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Kung Pao/ })).queryByText(/Also planned/)).not.toBeInTheDocument()
    await user.click(miso)
    expect(onPick).toHaveBeenCalledWith(4)
  })

  it('picking a recipe passes its id', async () => {
    const user = userEvent.setup()
    const { onPick, onCancel } = renderPicker()

    await user.click(screen.getByRole('button', { name: /Miso Soup/ }))

    expect(onPick).toHaveBeenCalledWith(4)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels on Cancel, Escape, or a click outside, but not a click inside', async () => {
    const user = userEvent.setup()
    const { onPick, onCancel } = renderPicker()

    await user.click(screen.getByRole('heading'))
    expect(onCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('dialog'))

    expect(onCancel).toHaveBeenCalledTimes(3)
    expect(onPick).not.toHaveBeenCalled()
  })
})
