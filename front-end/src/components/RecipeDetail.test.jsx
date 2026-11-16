import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import RecipeDetail from './RecipeDetail'
import { recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { savedBurritoBowls } from '../test/fixtures/recipes'
import { UNITS } from '../test/fixtures/units'

vi.mock('../services/api', () => ({
  recipeApi: { getRecipeById: vi.fn(), updateRecipe: vi.fn(), getUnits: vi.fn(), deleteRecipe: vi.fn() },
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

  describe('editing', () => {
    // The section whose <h2> matches `name`, for scoping repeated buttons/fields.
    const section = (name) => within(screen.getByRole('heading', { name }).closest('section'))
    const values = (elements) => elements.map(el => el.value)

    // What PUT /api/recipes/1 returns after the edit made in 'saves the changes ...'.
    const savedAfterEdit = {
      ...savedBurritoBowls,
      title: 'Chicken Burrito Bowls',
      ingredients: [
        { id: 11, name: 'corn kernels (drained)', quantity: 2, unit: 'CAN', packageQuantity: 15, packageUnit: 'OUNCE' },
      ],
      steps: [
        { id: 21, stepOrder: 1, instructionText: 'Cook the chicken.', estimatedTimeMinutes: null },
        { id: 22, stepOrder: 2, instructionText: 'Add rice and corn.', estimatedTimeMinutes: 10 },
        { id: 23, stepOrder: 3, instructionText: 'Serve.', estimatedTimeMinutes: null },
      ],
    }

    beforeEach(() => {
      recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
      recipeApi.getUnits.mockResolvedValue(UNITS)
      recipeApi.updateRecipe.mockResolvedValue(savedAfterEdit)
    })

    // Opens the recipe, clicks "Edit Recipe" and waits for the unit dropdowns to load.
    async function startEditing() {
      const user = userEvent.setup()
      renderDetail('1')
      await user.click(await screen.findByRole('button', { name: 'Edit Recipe' }))
      await screen.findAllByRole('option', { name: 'ounce' })
      return user
    }

    async function changeTitle(user, title) {
      await user.clear(screen.getByLabelText('Title *'))
      await user.type(screen.getByLabelText('Title *'), title)
    }

    it('opens the form pre-filled with the recipe, steps in order', async () => {
      await startEditing()

      expect(screen.getByRole('heading', { name: 'Edit Recipe' })).toBeInTheDocument()
      expect(screen.getByLabelText('Title *')).toHaveValue('Instant Pot Chicken Burrito Bowls')
      expect(screen.getByLabelText('Description')).toHaveValue('Burrito bowls made in the Instant Pot.')
      expect(screen.getByLabelText('Servings *')).toHaveValue(4)
      expect(screen.getByLabelText('Prep Time (min)')).toHaveValue(10)
      expect(values(section('Categories').getAllByRole('textbox'))).toEqual(['Dinner', 'Mexican'])
      expect(values(section('Equipment').getAllByRole('textbox'))).toEqual(['Instant Pot'])
      expect(values(screen.getAllByPlaceholderText('Ingredient name')))
        .toEqual(['corn kernels (drained)', 'uncooked long-grain white rice'])
      expect(values(screen.getAllByLabelText('Unit'))).toEqual(['CAN', 'CUP'])
      expect(values(screen.getAllByLabelText('Package quantity'))).toEqual(['15', ''])
      expect(values(screen.getAllByPlaceholderText('Instruction text')))
        .toEqual(['Cook the chicken.', 'Add rice and corn.'])
      expect(values(screen.getAllByPlaceholderText('Time (min)'))).toEqual(['', '10'])
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: '← Back to Recipes' })).not.toBeInTheDocument()
    })

    it('saves the changes with step and ingredient ids, and shows the saved recipe without reloading', async () => {
      const user = await startEditing()

      await changeTitle(user, 'Chicken Burrito Bowls')
      await user.clear(screen.getAllByPlaceholderText('Qty')[0])
      await user.type(screen.getAllByPlaceholderText('Qty')[0], '2')
      await user.click(section('Ingredients *').getAllByRole('button', { name: 'Remove' })[1])
      await user.click(screen.getByRole('button', { name: '+ Add Step' }))
      await user.type(screen.getAllByPlaceholderText('Instruction text')[2], 'Serve.')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(recipeApi.updateRecipe).toHaveBeenCalledWith('1', {
        title: 'Chicken Burrito Bowls',
        description: 'Burrito bowls made in the Instant Pot.',
        servings: 4,
        prepTimeMinutes: 10,
        cookTimeMinutes: 10,
        totalTimeMinutes: 20,
        ingredients: [
          { id: 11, name: 'corn kernels (drained)', quantity: 2, unit: 'CAN', packageQuantity: 15, packageUnit: 'OUNCE' },
        ],
        steps: [
          { id: 21, stepOrder: 1, instructionText: 'Cook the chicken.', estimatedTimeMinutes: null },
          { id: 22, stepOrder: 2, instructionText: 'Add rice and corn.', estimatedTimeMinutes: 10 },
          { stepOrder: 3, instructionText: 'Serve.', estimatedTimeMinutes: null },
        ],
        equipment: ['Instant Pot'],
        categories: ['Dinner', 'Mexican'],
      })

      expect(await screen.findByRole('heading', { name: 'Chicken Burrito Bowls' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Changes saved.')
      const rows = await ingredientRows()
      expect(rows).toHaveLength(1)
      expect(rows[0].querySelector('.quantity')).toHaveTextContent('2 CAN (15 OUNCE)')
      const steps = within(screen.getByRole('heading', { name: 'Instructions' }).closest('section'))
        .getAllByRole('listitem')
      expect(steps.map(s => s.querySelector('.instruction').textContent))
        .toEqual(['Cook the chicken.', 'Add rice and corn.', 'Serve.'])
      expect(recipeApi.getRecipeById).toHaveBeenCalledTimes(1)
    })

    it('shows "Saving..." and disables Save and Cancel while saving', async () => {
      let finish
      recipeApi.updateRecipe.mockReturnValue(new Promise(resolve => { finish = resolve }))
      const user = await startEditing()

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      finish(savedAfterEdit)
      expect(await screen.findByRole('heading', { name: 'Chicken Burrito Bowls' })).toBeInTheDocument()
    })

    it('keeps the edits and shows the reason when saving fails', async () => {
      recipeApi.updateRecipe.mockRejectedValueOnce(
        new Error('Failed to update recipe: Ingredient name is required'))
      const user = await startEditing()

      await changeTitle(user, 'My Bowls')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(await screen.findByText('Error: Failed to update recipe: Ingredient name is required'))
        .toBeInTheDocument()
      expect(screen.getByLabelText('Title *')).toHaveValue('My Bowls')
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(await screen.findByRole('heading', { name: 'Chicken Burrito Bowls' })).toBeInTheDocument()
    })

    it('Cancel with no changes goes straight back to the recipe', async () => {
      const confirm = vi.spyOn(window, 'confirm')
      const user = await startEditing()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByRole('heading', { name: 'Instant Pot Chicken Burrito Bowls' })).toBeInTheDocument()
      expect(confirm).not.toHaveBeenCalled()
      expect(recipeApi.updateRecipe).not.toHaveBeenCalled()
    })

    it('Cancel after changes asks first, and staying keeps the edits', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = await startEditing()

      await changeTitle(user, 'My Bowls')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(confirm).toHaveBeenCalledWith('Discard your changes?')
      expect(screen.getByLabelText('Title *')).toHaveValue('My Bowls')
    })

    it('Cancel after changes asks first, and discarding shows the recipe as it was', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = await startEditing()

      await changeTitle(user, 'My Bowls')
      await user.type(screen.getAllByPlaceholderText('Ingredient name')[0], ' and peas')
      await user.click(section('Ingredients *').getAllByRole('button', { name: 'Remove' })[1])
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByRole('heading', { name: 'Instant Pot Chicken Burrito Bowls' })).toBeInTheDocument()
      const rows = await ingredientRows()
      expect(rows.map(r => r.querySelector('.name').textContent))
        .toEqual(['corn kernels (drained)', 'uncooked long-grain white rice'])
      expect(recipeApi.updateRecipe).not.toHaveBeenCalled()
    })

    it('does not ask when a change was undone before cancelling', async () => {
      const confirm = vi.spyOn(window, 'confirm')
      const user = await startEditing()

      await changeTitle(user, 'My Bowls')
      await changeTitle(user, 'Instant Pot Chicken Burrito Bowls')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(confirm).not.toHaveBeenCalled()
    })

    it('scrolls the error, then "Changes saved.", into view (Save is at the bottom of the form)', async () => {
      const scrolledTo = []
      Element.prototype.scrollIntoView = function () { scrolledTo.push(this.textContent) }
      try {
        recipeApi.updateRecipe.mockRejectedValueOnce(new Error('Failed to update recipe'))
        const user = await startEditing()

        await user.click(screen.getByRole('button', { name: 'Save Changes' }))
        await screen.findByText('Error: Failed to update recipe')
        await user.click(screen.getByRole('button', { name: 'Save Changes' }))
        await screen.findByRole('status')

        expect(scrolledTo).toEqual(['Error: Failed to update recipe', 'Changes saved.'])
      } finally {
        delete Element.prototype.scrollIntoView
      }
    })

    it('clears "Changes saved." when editing again', async () => {
      const user = await startEditing()
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))
      await screen.findByRole('status')

      await user.click(screen.getByRole('button', { name: 'Edit Recipe' }))
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Chicken Burrito Bowls' })).toBeInTheDocument()
    })
  })

  describe('deleting', () => {
    beforeEach(() => {
      recipeApi.getRecipeById.mockResolvedValue(savedBurritoBowls)
      recipeApi.deleteRecipe.mockResolvedValue(undefined)
    })

    async function openDeleteDialog() {
      const user = userEvent.setup()
      renderDetail('1')
      await user.click(await screen.findByRole('button', { name: 'Delete Recipe' }))
      return { user, dialog: within(screen.getByRole('alertdialog', { name: 'Delete this recipe?' })) }
    }

    it('asks for confirmation, naming the recipe, before deleting anything', async () => {
      const { dialog } = await openDeleteDialog()

      expect(dialog.getByText('“Instant Pot Chicken Burrito Bowls” will be removed from your recipes.'))
        .toBeInTheDocument()
      expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(recipeApi.deleteRecipe).not.toHaveBeenCalled()
    })

    it('Cancel keeps the recipe and returns focus to the Delete button', async () => {
      const { user, dialog } = await openDeleteDialog()

      await user.click(dialog.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Instant Pot Chicken Burrito Bowls' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete Recipe' })).toHaveFocus()
      expect(recipeApi.deleteRecipe).not.toHaveBeenCalled()
    })

    it('confirming deletes the recipe and goes to the list, saying what was deleted', async () => {
      const { user, dialog } = await openDeleteDialog()

      await user.click(dialog.getByRole('button', { name: 'Delete' }))

      expect(recipeApi.deleteRecipe).toHaveBeenCalledWith('1')
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/))
      expect(JSON.parse(screen.getByTestId('location').dataset.state))
        .toEqual({ deletedRecipeTitle: 'Instant Pot Chicken Burrito Bowls' })
    })

    it('replaces the recipe in the history, so Back skips the deleted recipe', async () => {
      function ListWithBack() {
        const navigate = useNavigate()
        return <button onClick={() => navigate(-1)}>Back</button>
      }
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/earlier', '/recipe/1']} initialIndex={1}>
          <Routes>
            <Route path="/recipe/:id" element={<RecipeDetail />} />
            <Route path="/" element={<ListWithBack />} />
            <Route path="/earlier" element={<p>Earlier page</p>} />
          </Routes>
        </MemoryRouter>
      )

      await user.click(await screen.findByRole('button', { name: 'Delete Recipe' }))
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await user.click(await screen.findByRole('button', { name: 'Back' }))

      expect(screen.getByText('Earlier page')).toBeInTheDocument()
    })

    it('shows "Deleting..." and locks the dialog while deleting', async () => {
      let finish
      recipeApi.deleteRecipe.mockReturnValue(new Promise(resolve => { finish = resolve }))
      const { user, dialog } = await openDeleteDialog()

      await user.click(dialog.getByRole('button', { name: 'Delete' }))

      expect(dialog.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
      expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      finish()
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/))
    })

    it('shows the error in the dialog when deleting fails, and stays on the recipe', async () => {
      recipeApi.deleteRecipe.mockRejectedValueOnce(new Error('Failed to delete recipe'))
      const { user, dialog } = await openDeleteDialog()

      await user.click(dialog.getByRole('button', { name: 'Delete' }))

      expect(await dialog.findByRole('alert')).toHaveTextContent('Failed to delete recipe')
      expect(dialog.getByRole('button', { name: 'Delete' })).toBeEnabled()
      expect(screen.getByTestId('location')).toHaveTextContent('/recipe/1')

      await user.click(dialog.getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/))
    })

    it('forgets a failed attempt when the dialog is reopened', async () => {
      recipeApi.deleteRecipe.mockRejectedValueOnce(new Error('Failed to delete recipe'))
      const { user, dialog } = await openDeleteDialog()
      await user.click(dialog.getByRole('button', { name: 'Delete' }))
      await dialog.findByRole('alert')

      await user.click(dialog.getByRole('button', { name: 'Cancel' }))
      await user.click(screen.getByRole('button', { name: 'Delete Recipe' }))

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
