import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeSearch from './RecipeSearch'
import { emptyFilters } from './recipeSearch'

// RecipeSearch with real state, reporting every change to `onChange`.
function renderSearch(initial = {}, categories = ['Dinner', 'Dessert']) {
  const onChange = vi.fn()
  function Harness() {
    const [filters, setFilters] = useState({ ...emptyFilters(), ...initial })
    return (
      <RecipeSearch
        filters={filters}
        categories={categories}
        onChange={(next) => { onChange(next); setFilters(next) }}
      />
    )
  }
  render(<Harness />)
  return { user: userEvent.setup(), onChange }
}

const chipTexts = () =>
  within(screen.getByRole('list', { name: 'Active filters' })).getAllByRole('listitem').map(li => li.textContent)

describe('RecipeSearch', () => {
  it('is a search landmark with a search box and a collapsed filters panel', () => {
    renderSearch()

    expect(screen.getByRole('search', { name: 'Recipe search' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Filters ▾' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Category')).not.toBeVisible()   // panel is hidden
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument()
  })

  it('reports the complete filters on every change', async () => {
    const { user, onChange } = renderSearch()

    await user.type(screen.getByRole('searchbox'), 'ch')

    expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), query: 'ch' })
  })

  it('the Filters button opens the panel with every field, and suggests categories', async () => {
    const { user, onChange } = renderSearch()

    await user.click(screen.getByRole('button', { name: 'Filters ▾' }))

    expect(screen.getByRole('button', { name: 'Filters ▴' })).toHaveAttribute('aria-expanded', 'true')
    const category = screen.getByLabelText('Category')
    expect([...document.getElementById(category.getAttribute('list')).options].map(o => o.value))
      .toEqual(['Dinner', 'Dessert'])
    await user.type(category, 'Din')
    await user.type(screen.getByLabelText('Ingredient'), 'egg')
    await user.type(screen.getByLabelText('Max prep (min)'), '15')
    await user.type(screen.getByLabelText('Max cook (min)'), '20')
    await user.type(screen.getByLabelText('Max total (min)'), '30')
    await user.click(screen.getByRole('checkbox', { name: 'Only recipes excluded from meal plans' }))

    expect(onChange).toHaveBeenLastCalledWith({
      query: '', category: 'Din', ingredient: 'egg',
      maxPrepTimeMinutes: '15', maxCookTimeMinutes: '20', maxTotalTimeMinutes: '30', excludedOnly: true,
    })
  })

  it('shows a chip per filter in use, and counts the panel\'s filters on the Filters button', () => {
    renderSearch({ query: 'soup', category: 'Dinner', maxTotalTimeMinutes: '45' })

    expect(chipTexts()).toEqual(['Search: soup✕', 'Category: Dinner✕', 'Max total: 45 min✕'])
    expect(screen.getByRole('button', { name: 'Filters (2) ▾' })).toBeInTheDocument()
  })

  it('a chip\'s ✕ clears just that filter (and its field), keeping focus in the search', async () => {
    const { user, onChange } = renderSearch({ query: 'soup', ingredient: 'onion' })
    await user.click(screen.getByRole('button', { name: /Filters/ }))

    await user.click(screen.getByRole('button', { name: 'Remove Ingredient filter' }))

    expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters(), query: 'soup' })
    expect(screen.getByLabelText('Ingredient')).toHaveValue('')
    expect(chipTexts()).toEqual(['Search: soup✕'])
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('"Only recipes excluded from meal plans" shows a chip whose ✕ unticks it', async () => {
    const { user, onChange } = renderSearch({ excludedOnly: true })
    await user.click(screen.getByRole('button', { name: 'Filters (1) ▾' }))
    const checkbox = screen.getByRole('checkbox', { name: 'Only recipes excluded from meal plans' })
    expect(checkbox).toBeChecked()
    expect(chipTexts()).toEqual(['Meal plans: excluded only✕'])

    await user.click(screen.getByRole('button', { name: 'Remove Meal plans filter' }))

    expect(checkbox).not.toBeChecked()
    expect(onChange.mock.calls.at(-1)[0].excludedOnly).toBeFalsy()
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument()
  })

  it('Clear all clears every filter and hides the chips', async () => {
    const { user, onChange } = renderSearch({ query: 'soup', maxPrepTimeMinutes: '10' })

    await user.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(onChange).toHaveBeenLastCalledWith(emptyFilters())
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('collapsing the panel keeps its filters', async () => {
    const { user } = renderSearch()
    await user.click(screen.getByRole('button', { name: /Filters/ }))
    await user.type(screen.getByLabelText('Ingredient'), 'garlic')

    await user.click(screen.getByRole('button', { name: /Filters/ }))

    expect(screen.getByLabelText('Ingredient')).not.toBeVisible()
    expect(chipTexts()).toEqual(['Ingredient: garlic✕'])
  })

  it('never submits the form (which would reload the page)', () => {
    renderSearch({ query: 'soup' })

    const notCancelled = fireEvent.submit(screen.getByRole('search'))

    expect(notCancelled).toBe(false)
    expect(screen.getByRole('searchbox')).toHaveValue('soup')
  })
})
