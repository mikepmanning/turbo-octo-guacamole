import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeList from './RecipeList'
import { recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { importedBurritoBowls, savedBurritoBowls } from '../test/fixtures/recipes'

vi.mock('../services/api', () => ({
  recipeApi: { getAllRecipes: vi.fn(), importRecipeFromUrl: vi.fn() },
}))

const renderList = () => renderWithRouter(<RecipeList />, { path: '/', route: '/' })

describe('RecipeList', () => {
  it('shows a loading message until recipes arrive', async () => {
    recipeApi.getAllRecipes.mockResolvedValue([])
    renderList()

    expect(screen.getByText('Loading recipes...')).toBeInTheDocument()
    await screen.findByText('No recipes found. Create your first recipe!')
    expect(screen.queryByText('Loading recipes...')).not.toBeInTheDocument()
  })

  it('shows a card per recipe linking to its detail page', async () => {
    recipeApi.getAllRecipes.mockResolvedValue([
      savedBurritoBowls,
      { id: 2, title: 'Toast', description: 'Bread, toasted.', totalTimeMinutes: 3, servings: 1, categories: [] },
    ])
    renderList()

    const card = await screen.findByRole('link', { name: /Instant Pot Chicken Burrito Bowls/ })
    expect(card).toHaveAttribute('href', '/recipe/1')
    expect(within(card).getByText('Burrito bowls made in the Instant Pot.')).toBeInTheDocument()
    expect(within(card).getByText('⏱️ 20 min')).toBeInTheDocument()
    expect(within(card).getByText('🍽️ 4 servings')).toBeInTheDocument()
    expect(within(card).getByText('Dinner')).toBeInTheDocument()
    expect(within(card).getByText('Mexican')).toBeInTheDocument()

    const toast = screen.getByRole('link', { name: /Toast/ })
    expect(toast).toHaveAttribute('href', '/recipe/2')
    expect(toast.querySelector('.categories')).toBeNull()
  })

  it('shows an empty-state message when there are no recipes', async () => {
    recipeApi.getAllRecipes.mockResolvedValue([])
    renderList()

    expect(await screen.findByText('No recipes found. Create your first recipe!')).toBeInTheDocument()
  })

  it('shows the error and reloads on Retry', async () => {
    const user = userEvent.setup()
    recipeApi.getAllRecipes
      .mockRejectedValueOnce(new Error('Failed to fetch recipes'))
      .mockResolvedValueOnce([savedBurritoBowls])
    renderList()

    expect(await screen.findByText('Error: Failed to fetch recipes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('link', { name: /Burrito Bowls/ })).toBeInTheDocument()
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument()
    expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(2)
  })

  it('links "+ Add Recipe" to the new recipe form', async () => {
    recipeApi.getAllRecipes.mockResolvedValue([])
    renderList()

    expect(screen.getByRole('link', { name: '+ Add Recipe' })).toHaveAttribute('href', '/recipe/new')
    await screen.findByText(/No recipes found/)
  })

  it('opens the import dialog and sends the imported recipe to the form', async () => {
    const user = userEvent.setup()
    recipeApi.getAllRecipes.mockResolvedValue([])
    recipeApi.importRecipeFromUrl.mockResolvedValue(importedBurritoBowls)
    renderList()
    await screen.findByText(/No recipes found/)

    expect(screen.queryByRole('heading', { name: 'Import Recipe from URL' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Import Recipe' }))
    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), 'https://damndelicious.net/x')
    await user.click(screen.getByRole('button', { name: 'Import' }))

    // The probe is always rendered, so wait for the path to change rather than for the element.
    const location = screen.getByTestId('location')
    await waitFor(() => expect(location).toHaveTextContent('/recipe/new'))
    expect(JSON.parse(location.dataset.state)).toEqual({ importedRecipe: importedBurritoBowls })
  })

  it('closes the import dialog on Cancel', async () => {
    const user = userEvent.setup()
    recipeApi.getAllRecipes.mockResolvedValue([])
    renderList()
    await screen.findByText(/No recipes found/)

    await user.click(screen.getByRole('button', { name: '+ Import Recipe' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Import Recipe from URL' })).not.toBeInTheDocument()
  })
})
