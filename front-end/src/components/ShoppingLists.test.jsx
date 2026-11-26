import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingLists from './ShoppingLists'
import { shoppingListApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'

vi.mock('../services/api', () => ({
  shoppingListApi: { getShoppingLists: vi.fn() },
}))

const renderPage = () => renderWithRouter(<ShoppingLists />, { path: '/shopping-lists', route: '/shopping-lists' })
const cards = () => within(screen.getByRole('list')).getAllByRole('link')

const summary = (id, name, startDate, endDate, extra = {}) => ({
  mealPlanId: id, mealPlanName: name, startDate, endDate, days: 3,
  itemCount: 10, checkedCount: 0, generatedAt: '2026-06-01T09:00:00', planChangedSince: false, ...extra,
})

// As the server sends them: latest plan first. Today is Jun 15 2026.
const LISTS = [
  summary(4, 'Far future', '2026-07-20', '2026-07-22'),
  summary(3, 'Next week', '2026-06-22', '2026-06-24', { planChangedSince: true }),
  summary(2, 'This week', '2026-06-14', '2026-06-16', { checkedCount: 4 }),
  summary(1, null, '2026-06-01', '2026-06-03', { checkedCount: 10 }),
]

describe('ShoppingLists', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 15, 9, 0))
    shoppingListApi.getShoppingLists.mockResolvedValue(LISTS)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists the current list first, then upcoming ones soonest first, then past ones', async () => {
    renderPage()

    expect(screen.getByText('Loading shopping lists...')).toBeInTheDocument()
    await screen.findByText('This week')
    expect(cards().map(card => card.getAttribute('href'))).toEqual([
      '/meal-plans/2/shopping-list',
      '/meal-plans/3/shopping-list',
      '/meal-plans/4/shopping-list',
      '/meal-plans/1/shopping-list',
    ])
    expect(screen.getByRole('link', { name: '← Back to Recipes' })).toHaveAttribute('href', '/')
  })

  it('shows each list\'s plan, status and progress', async () => {
    renderPage()
    await screen.findByText('This week')

    const [current, next, , past] = cards()
    expect(current).toHaveTextContent('This week')
    expect(current).toHaveTextContent('Current')
    expect(current).toHaveTextContent('4 of 10 in the cart')
    expect(next).toHaveTextContent('Upcoming')
    expect(next).toHaveTextContent('the meal plan has changed since')
    expect(past).toHaveTextContent('Past')
    expect(past).toHaveTextContent('All done: 10 of 10 in the cart')
    expect(past).toHaveTextContent('Jun 1 – Jun 3')   // no name: the automatic one
  })

  it('points to meal plans when there are no lists yet', async () => {
    shoppingListApi.getShoppingLists.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/No shopping lists yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'meal plan' })).toHaveAttribute('href', '/meal-plans')
  })

  it('shows a load error, and tries again on Retry', async () => {
    const user = userEvent.setup()
    shoppingListApi.getShoppingLists.mockRejectedValueOnce(new Error('Failed to load shopping lists'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load shopping lists')
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('This week')).toBeInTheDocument()
  })
})
