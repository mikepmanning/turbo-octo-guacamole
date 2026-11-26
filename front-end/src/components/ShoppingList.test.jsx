import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingList from './ShoppingList'
import { mealPlanApi, shoppingListApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { savedMealPlan } from '../test/fixtures/mealPlans'
import { shoppingList } from '../test/fixtures/shoppingLists'

vi.mock('../services/api', () => ({
  mealPlanApi: { getMealPlan: vi.fn() },
  shoppingListApi: { getShoppingList: vi.fn(), generateShoppingList: vi.fn(), setItemChecked: vi.fn() },
}))

const renderPage = () =>
  renderWithRouter(<ShoppingList />, { path: '/meal-plans/:id/shopping-list', route: '/meal-plans/9/shopping-list' })

const section = (name) => within(screen.getByRole('region', { name }))
const findSection = async (name) => within(await screen.findByRole('region', { name }))

describe('ShoppingList', () => {
  beforeEach(() => {
    mealPlanApi.getMealPlan.mockResolvedValue(savedMealPlan)
    shoppingListApi.getShoppingList.mockResolvedValue(shoppingList)
  })

  it('shows what to buy and what is in the cart, with who ticked it', async () => {
    renderPage()

    expect(screen.getByText('Loading shopping list...')).toBeInTheDocument()
    const toBuy = await findSection('To buy (2)')
    expect(toBuy.getAllByRole('checkbox').map(box => box.closest('label').textContent))
      .toEqual(['2 cups buttermilk', '1 pound chicken thighs'])
    expect(toBuy.getByText('for Kung Pao Chicken, Buttermilk Pancakes')).toBeInTheDocument()

    const cart = section('In the cart (1)')
    expect(cart.getByRole('checkbox', { name: '2 cans (15 ounces) black beans' })).toBeChecked()
    expect(cart.getByText('for Kung Pao Chicken · ✓ Grace')).toBeInTheDocument()

    expect(screen.getByText(/^Long weekend · /)).toBeInTheDocument()
    expect(screen.getByText(/Made by Ada Lovelace on May 30, 3:40 PM · 1 of 3 in the cart/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Back to meal plan' })).toHaveAttribute('href', '/meal-plans/9')
    expect(mealPlanApi.getMealPlan).toHaveBeenCalledWith('9')
    expect(shoppingListApi.getShoppingList).toHaveBeenCalledWith('9')
  })

  it('ticks an item off at once, then shows the list the server sends back', async () => {
    const user = userEvent.setup()
    let finish
    shoppingListApi.setItemChecked.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderPage()

    await user.click((await findSection('To buy (2)')).getByRole('checkbox', { name: '2 cups buttermilk' }))

    expect(section('In the cart (2)').getByRole('checkbox', { name: '2 cups buttermilk' })).toBeChecked()
    expect(shoppingListApi.setItemChecked).toHaveBeenCalledWith('9', 102, true)

    const fromServer = {
      ...shoppingList,
      items: shoppingList.items.map(item => (item.id === 102
        ? { ...item, checked: true, checkedBy: { id: 1, firstName: 'Ada', lastName: 'Lovelace' } }
        : item)),
    }
    await act(async () => finish(fromServer))
    expect(section('In the cart (2)').getByText('for Buttermilk Pancakes · ✓ Ada')).toBeInTheDocument()
  })

  it('unticks an item back onto the list', async () => {
    const user = userEvent.setup()
    shoppingListApi.setItemChecked.mockResolvedValue({
      ...shoppingList, items: shoppingList.items.map(item => ({ ...item, checked: false, checkedBy: null })),
    })
    renderPage()

    await user.click((await findSection('In the cart (1)')).getByRole('checkbox'))

    expect(shoppingListApi.setItemChecked).toHaveBeenCalledWith('9', 101, false)
    expect(await findSection('To buy (3)')).toBeTruthy()
    expect(screen.queryByRole('region', { name: /In the cart/ })).not.toBeInTheDocument()
  })

  it('puts the tick back and says why when saving it fails', async () => {
    const user = userEvent.setup()
    shoppingListApi.setItemChecked.mockRejectedValue(new Error('Could not update the item'))
    renderPage()

    await user.click((await findSection('To buy (2)')).getByRole('checkbox', { name: '2 cups buttermilk' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the item')
    expect(section('To buy (2)').getByRole('checkbox', { name: '2 cups buttermilk' })).not.toBeChecked()
  })

  it('offers to make the list when there is none yet', async () => {
    const user = userEvent.setup()
    shoppingListApi.getShoppingList.mockResolvedValue(null)
    shoppingListApi.generateShoppingList.mockResolvedValue(shoppingList)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Make shopping list' }))

    expect(shoppingListApi.generateShoppingList).toHaveBeenCalledWith('9')
    expect(await findSection('To buy (2)')).toBeTruthy()
  })

  it('says it is making the list, and why it could not', async () => {
    const user = userEvent.setup()
    shoppingListApi.getShoppingList.mockResolvedValue(null)
    let fail
    shoppingListApi.generateShoppingList.mockReturnValue(new Promise((_, reject) => { fail = reject }))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Make shopping list' }))
    expect(screen.getByRole('button', { name: 'Making list...' })).toBeDisabled()

    await act(async () => fail(new Error('Could not make the shopping list')))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not make the shopping list')
    expect(screen.getByRole('button', { name: 'Make shopping list' })).toBeEnabled()
  })

  it('says when the plan changed, and updates the list from it', async () => {
    const user = userEvent.setup()
    shoppingListApi.getShoppingList.mockResolvedValue({ ...shoppingList, planChangedSince: true })
    shoppingListApi.generateShoppingList.mockResolvedValue({ ...shoppingList, items: shoppingList.items.slice(0, 2) })
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent('The meal plan has changed since this list was made.')
    await user.click(screen.getByRole('button', { name: 'Update from meal plan' }))

    expect(shoppingListApi.generateShoppingList).toHaveBeenCalledWith('9')
    expect(await findSection('To buy (1)')).toBeTruthy()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('names the recipes that were left out', async () => {
    shoppingListApi.getShoppingList.mockResolvedValue({ ...shoppingList, leftOutRecipes: ['Old Tacos'] })
    renderPage()

    expect(await screen.findByText('Left out because they are no longer available: Old Tacos.')).toBeInTheDocument()
  })

  it('says when there is nothing to buy, or everything is in the cart', async () => {
    shoppingListApi.getShoppingList.mockResolvedValueOnce({ ...shoppingList, items: [] })
    const { unmount } = renderPage()
    expect(await screen.findByText('Nothing to buy: the recipes in this plan have no ingredients.')).toBeInTheDocument()
    unmount()

    shoppingListApi.getShoppingList.mockResolvedValueOnce({
      ...shoppingList, items: shoppingList.items.map(item => ({ ...item, checked: true })),
    })
    renderPage()
    expect(await screen.findByText('Everything is in the cart.')).toBeInTheDocument()
  })

  it('loads the latest ticks on Refresh and when the window gets focus again', async () => {
    const user = userEvent.setup()
    renderPage()
    await findSection('To buy (2)')

    shoppingListApi.getShoppingList.mockResolvedValue({
      ...shoppingList, items: shoppingList.items.map(item => ({ ...item, checked: true })),
    })
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(await findSection('In the cart (3)')).toBeTruthy()

    shoppingListApi.getShoppingList.mockResolvedValue(shoppingList)
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await findSection('In the cart (1)')).toBeTruthy()
  })

  it('says why Refresh failed', async () => {
    const user = userEvent.setup()
    renderPage()
    await findSection('To buy (2)')
    shoppingListApi.getShoppingList.mockRejectedValue(new Error('Failed to load the shopping list'))

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the shopping list')
  })

  it('shows a load error, and tries again on Retry', async () => {
    const user = userEvent.setup()
    mealPlanApi.getMealPlan.mockRejectedValueOnce(new Error('Failed to load meal plan: Meal plan not found with id: 9'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Meal plan not found with id: 9')
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await findSection('To buy (2)')).toBeTruthy()
  })
})
