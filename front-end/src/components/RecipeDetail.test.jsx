import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeDetail from './RecipeDetail'
import { recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { savedBurritoBowls } from '../test/fixtures/recipes'

vi.mock('../services/api', () => ({
  recipeApi: { getRecipeById: vi.fn() },
}))

const renderDetail = (id = '1') =>
  renderWithRouter(<RecipeDetail />, { path: '/recipe/:id', route: `/recipe/${id}` })

const ingredientRows = async () => {
  const heading = await screen.findByRole('heading', { name: 'Ingredients' })
  return within(heading.closest('section')).getAllByRole('listitem')
}

describe('RecipeDetail', () => {
  it('loads the recipe for the id in the URL', async () => {
    recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
    renderDetail('1')

    expect(screen.getByText('Loading recipe...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: savedBurritoBowls.title })).toBeInTheDocument()
    expect(recipeApi.getRecipeById).toHaveBeenCalledWith('1')
  })

  it('shows the description, times, servings and categories', async () => {
    recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
    renderDetail()

    await screen.findByRole('heading', { name: savedBurritoBowls.title })
    expect(screen.getByText('Burrito bowls made in the Instant Pot.')).toBeInTheDocument()
    const info = document.querySelector('.recipe-info')
    expect(info).toHaveTextContent('Prep Time:10 min')
    expect(info).toHaveTextContent('Cook Time:10 min')
    expect(info).toHaveTextContent('Total Time:20 min')
    expect(info).toHaveTextContent('Servings:4')
    expect(screen.getByText('Dinner')).toHaveClass('category-tag')
    expect(screen.getByText('Mexican')).toHaveClass('category-tag')
  })

  it('leaves out optional sections the recipe does not have', async () => {
    recipeApi.getRecipeById.mockResolvedValue({
      id: 2, title: 'Plain', ingredients: [], steps: [], equipment: [], categories: [],
    })
    renderDetail('2')

    await screen.findByRole('heading', { name: 'Plain' })
    expect(document.querySelector('.description')).toBeNull()
    expect(document.querySelector('.recipe-info')).toBeEmptyDOMElement()
    expect(document.querySelector('.categories')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Ingredients' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Equipment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Instructions' })).not.toBeInTheDocument()
  })

  describe('package size', () => {
    it('shows "(15 OUNCE)" after the unit when the ingredient has a package', async () => {
      recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
      renderDetail()

      const [corn] = await ingredientRows()
      expect(corn.querySelector('.quantity')).toHaveTextContent('1 CAN (15 OUNCE)')
      expect(within(corn).getByText('(15 OUNCE)', { exact: false })).toHaveClass('package')
      expect(corn.querySelector('.name')).toHaveTextContent('corn kernels (drained)')
    })

    it.each([
      { desc: 'no package', pkg: { packageQuantity: null, packageUnit: null }, expected: '1 JAR' },
      { desc: 'missing package fields', pkg: {}, expected: '1 JAR' },
      { desc: 'a unit but no quantity', pkg: { packageQuantity: null, packageUnit: 'OUNCE' }, expected: '1 JAR' },
      { desc: 'a quantity but no unit', pkg: { packageQuantity: 2, packageUnit: null }, expected: '1 JAR (2)' },
      { desc: 'a decimal quantity', pkg: { packageQuantity: 4.5, packageUnit: 'OUNCE' }, expected: '1 JAR (4.5 OUNCE)' },
    ])('with $desc shows "$expected"', async ({ pkg, expected }) => {
      recipeApi.getRecipeById.mockResolvedValue({
        id: 3, title: 'Edge cases', steps: [],
        ingredients: [{ id: 1, name: 'salsa', quantity: 1, unit: 'JAR', ...pkg }],
      })
      renderDetail('3')

      const [row] = await ingredientRows()
      expect(row.querySelector('.quantity').textContent).toBe(expected)
      expect(row.querySelector('.package') !== null).toBe(expected.includes('('))
    })
  })

  it('lists equipment', async () => {
    recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
    renderDetail()

    const heading = await screen.findByRole('heading', { name: 'Equipment' })
    expect(within(heading.closest('section')).getByRole('listitem')).toHaveTextContent('Instant Pot')
  })

  it('shows steps in stepOrder with their estimated time', async () => {
    recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
    renderDetail()

    const heading = await screen.findByRole('heading', { name: 'Instructions' })
    const steps = within(heading.closest('section')).getAllByRole('listitem')
    expect(steps.map(s => s.querySelector('.instruction').textContent))
      .toEqual(['Cook the chicken.', 'Add rice and corn.'])
    expect(steps[0].querySelector('.step-time')).toBeNull()
    expect(steps[1].querySelector('.step-time')).toHaveTextContent('10 min')
  })

  it('shows the error with a way back when loading fails', async () => {
    const user = userEvent.setup()
    recipeApi.getRecipeById.mockRejectedValue(new Error('Failed to fetch recipe'))
    renderDetail('99')

    expect(await screen.findByText('Error: Failed to fetch recipe')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Recipes' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })

  it('shows "Recipe not found" when the API returns nothing', async () => {
    recipeApi.getRecipeById.mockResolvedValue(null)
    renderDetail('99')

    expect(await screen.findByText('Recipe not found')).toBeInTheDocument()
  })

  it('"← Back to Recipes" returns to the list', async () => {
    const user = userEvent.setup()
    recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
    renderDetail()

    await user.click(await screen.findByRole('button', { name: '← Back to Recipes' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })
})
