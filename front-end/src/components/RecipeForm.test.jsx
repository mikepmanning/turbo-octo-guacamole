import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeForm from './RecipeForm'
import { recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { UNITS } from '../test/fixtures/units'
import { importedBurritoBowls } from '../test/fixtures/recipes'

vi.mock('../services/api', () => ({
  recipeApi: { getUnits: vi.fn(), createRecipe: vi.fn() },
}))

// Renders the form (optionally with an imported recipe) and waits for the units to load.
async function renderForm(importedRecipe) {
  const user = userEvent.setup()
  renderWithRouter(<RecipeForm />, {
    path: '/recipe/new',
    route: '/recipe/new',
    state: importedRecipe ? { importedRecipe } : undefined,
  })
  await screen.findAllByRole('option', { name: 'ounce' })
  return user
}

// The <section> whose <h2> matches `name`, for scoping repeated buttons/fields.
const section = (name) =>
  within(screen.getByRole('heading', { name }).closest('section'))

const values = (elements) => elements.map(el => el.value)

describe('RecipeForm', () => {
  beforeEach(() => {
    recipeApi.getUnits.mockResolvedValue(UNITS)
    recipeApi.createRecipe.mockResolvedValue({ id: 42 })
  })

  describe('new recipe', () => {
    it('starts as an empty "Add New Recipe" form with one row per section', async () => {
      await renderForm()

      expect(screen.getByRole('heading', { name: 'Add New Recipe' })).toBeInTheDocument()
      expect(screen.getByLabelText('Title *')).toHaveValue('')
      expect(screen.getAllByPlaceholderText('Ingredient name')).toHaveLength(1)
      expect(screen.getByLabelText('Unit')).toHaveValue('')
      expect(screen.getByLabelText('Package unit')).toHaveValue('')
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.queryByText('Original Ingredient Text')).not.toBeInTheDocument()
    })

    it('sends the entered recipe with numbers parsed and blank rows dropped', async () => {
      const user = await renderForm()

      await user.type(screen.getByLabelText('Title *'), 'Tacos')
      await user.type(screen.getByLabelText('Description'), 'Taco night')
      await user.type(screen.getByLabelText('Servings *'), '2')
      await user.type(screen.getByLabelText('Prep Time (min)'), '5')

      await user.type(section('Categories').getByRole('textbox'), 'Dinner')
      await user.click(screen.getByRole('button', { name: '+ Add Category' }))   // left blank

      await user.type(screen.getByPlaceholderText('Ingredient name'), 'black beans')
      await user.type(screen.getByPlaceholderText('Qty'), '2')
      await user.selectOptions(screen.getByLabelText('Unit'), 'CAN')
      await user.type(screen.getByLabelText('Package quantity'), '15')
      await user.selectOptions(screen.getByLabelText('Package unit'), 'OUNCE')

      await user.type(screen.getByPlaceholderText('Instruction text'), 'Warm the beans.')
      await user.type(screen.getByPlaceholderText('Time (min)'), '5')
      await user.click(screen.getByRole('button', { name: '+ Add Step' }))
      await user.type(screen.getAllByPlaceholderText('Instruction text')[1], 'Serve.')

      await user.click(screen.getByRole('button', { name: 'Add Recipe' }))

      expect(recipeApi.createRecipe).toHaveBeenCalledWith({
        title: 'Tacos',
        description: 'Taco night',
        servings: 2,
        prepTimeMinutes: 5,
        cookTimeMinutes: null,
        totalTimeMinutes: null,
        ingredients: [
          { name: 'black beans', quantity: 2, unit: 'CAN', packageQuantity: 15, packageUnit: 'OUNCE' },
        ],
        steps: [
          { stepOrder: 1, instructionText: 'Warm the beans.', estimatedTimeMinutes: 5 },
          { stepOrder: 2, instructionText: 'Serve.', estimatedTimeMinutes: null },
        ],
        equipment: [],
        categories: ['Dinner'],
      })
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/recipe/42'))
    })
  })

  describe('imported recipe', () => {
    it('is titled "Import Recipe" and pre-fills the basic information', async () => {
      await renderForm(importedBurritoBowls)

      expect(screen.getByRole('heading', { name: 'Import Recipe' })).toBeInTheDocument()
      expect(screen.getByLabelText('Title *')).toHaveValue('Instant Pot Chicken Burrito Bowls')
      expect(screen.getByLabelText('Description')).toHaveValue('Burrito bowls made in the Instant Pot.')
      expect(screen.getByLabelText('Servings *')).toHaveValue(4)
      expect(screen.getByLabelText('Prep Time (min)')).toHaveValue(10)
      expect(screen.getByLabelText('Cook Time (min)')).toHaveValue(10)
      expect(screen.getByLabelText('Total Time (min)')).toHaveValue(20)
      expect(section('Categories').getByRole('textbox')).toHaveValue('Dinner')
      expect(section('Equipment').getByRole('textbox')).toHaveValue('Instant Pot')
    })

    it('pre-fills ingredients, units and package sizes, and shows the original text', async () => {
      await renderForm(importedBurritoBowls)

      expect(values(screen.getAllByPlaceholderText('Ingredient name')))
        .toEqual(['corn kernels (drained)', 'uncooked long-grain white rice'])
      expect(values(screen.getAllByPlaceholderText('Qty'))).toEqual(['1', '1'])
      expect(values(screen.getAllByLabelText('Unit'))).toEqual(['CAN', 'CUP'])
      expect(values(screen.getAllByLabelText('Package quantity'))).toEqual(['15', ''])
      expect(values(screen.getAllByLabelText('Package unit'))).toEqual(['OUNCE', ''])
      expect(screen.getByLabelText('Original Ingredient Text', { selector: '#ingredient-raw-0' }))
        .toHaveValue('1 (15-ounce) can corn kernels (drained)')
      expect(screen.getByLabelText('Original Ingredient Text', { selector: '#ingredient-raw-0' }))
        .toHaveAttribute('readonly')
    })

    it('pre-fills steps and shows the original step text', async () => {
      await renderForm(importedBurritoBowls)

      expect(screen.getByPlaceholderText('Instruction text')).toHaveValue('Cook the chicken.')
      expect(screen.getByLabelText('Original Step Text')).toHaveValue('Cook the chicken.')
    })

    it('sends the package size it was given', async () => {
      const user = await renderForm(importedBurritoBowls)

      await user.click(screen.getByRole('button', { name: 'Add Recipe' }))

      const sent = recipeApi.createRecipe.mock.calls[0][0]
      expect(sent.ingredients).toEqual([
        { name: 'corn kernels (drained)', quantity: 1, unit: 'CAN', packageQuantity: 15, packageUnit: 'OUNCE' },
        { name: 'uncooked long-grain white rice', quantity: 1, unit: 'CUP', packageQuantity: null, packageUnit: null },
      ])
    })

    it('sends the source URL along with the recipe', async () => {
      const user = await renderForm(importedBurritoBowls)

      await user.click(screen.getByRole('button', { name: 'Add Recipe' }))

      expect(recipeApi.createRecipe.mock.calls[0][0].sourceUrl)
        .toBe('https://damndelicious.net/burrito-bowls/')
    })

    it('falls back to empty fields when the import is missing values', async () => {
      await renderForm({
        title: 'Sparse',
        ingredients: [{ name: null, quantity: null, unit: null }],
        steps: [{ instructionText: null, instruction: 'Legacy field text' }],
        equipment: [],
        categories: [],
      })

      expect(screen.getByLabelText('Servings *')).toHaveValue(null)
      expect(screen.getByLabelText('Description')).toHaveValue('')
      expect(screen.getByPlaceholderText('Ingredient name')).toHaveValue('')
      expect(screen.getByPlaceholderText('Qty')).toHaveValue(null)
      expect(screen.getByLabelText('Unit')).toHaveValue('')
      expect(screen.getByLabelText('Package quantity')).toHaveValue(null)
      expect(screen.getByLabelText('Package unit')).toHaveValue('')
      expect(screen.getByPlaceholderText('Instruction text')).toHaveValue('Legacy field text')
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(section('Categories').getAllByRole('textbox')).toHaveLength(1)
      expect(screen.queryByText('Original Ingredient Text')).not.toBeInTheDocument()
    })

    it('keeps the default rows when the import has no ingredients or steps', async () => {
      await renderForm({ title: 'Title only', ingredients: [], steps: [] })

      expect(screen.getByLabelText('Title *')).toHaveValue('Title only')
      expect(screen.getAllByPlaceholderText('Ingredient name')).toHaveLength(1)
      expect(screen.getAllByPlaceholderText('Instruction text')).toHaveLength(1)
    })
  })

  describe('unit dropdowns', () => {
    const groupLabels = (select) =>
      [...select.querySelectorAll('optgroup')].map(g => g.label)

    it('offers every unit, grouped by category', async () => {
      await renderForm()
      const unit = screen.getByLabelText('Unit')

      expect(groupLabels(unit)).toEqual(['Volume', 'Weight', 'Container', 'Count'])
      expect(within(unit).getAllByRole('option').map(o => o.textContent))
        .toEqual(['Unit', 'cup', 'tablespoon', 'ounce', 'pound', 'can', 'each'])
      expect(within(unit).getByRole('option', { name: 'Unit' })).toBeDisabled()
    })

    it('offers only volume and weight units for the package', async () => {
      await renderForm()
      const pkg = screen.getByLabelText('Package unit')

      expect(groupLabels(pkg)).toEqual(['Volume', 'Weight'])
      expect(within(pkg).getAllByRole('option').map(o => o.value))
        .toEqual(['', 'CUP', 'TABLESPOON', 'OUNCE', 'POUND'])
      expect(within(pkg).getByRole('option', { name: 'No package' })).toHaveValue('')
    })

    it('skips empty groups', async () => {
      recipeApi.getUnits.mockResolvedValue(UNITS.filter(u => u.category !== 'CONTAINER'))
      await renderForm()

      expect(groupLabels(screen.getByLabelText('Unit'))).toEqual(['Volume', 'Weight', 'Count'])
    })

    it('shows an error when the units cannot be loaded', async () => {
      recipeApi.getUnits.mockRejectedValue(new Error('Failed to fetch units'))
      renderWithRouter(<RecipeForm />, { path: '/recipe/new', route: '/recipe/new' })

      expect(await screen.findByText('Error: Could not load units: Failed to fetch units'))
        .toBeInTheDocument()
    })
  })

  describe('package size must be complete', () => {
    it('blocks saving a package quantity without a package unit', async () => {
      const user = await renderForm(importedBurritoBowls)

      await user.type(screen.getAllByLabelText('Package quantity')[1], '2')
      await user.click(screen.getByRole('button', { name: 'Add Recipe' }))

      expect(screen.getAllByLabelText('Package unit')[1]).toBeRequired()
      expect(screen.getAllByLabelText('Package unit')[1]).toBeInvalid()
      expect(recipeApi.createRecipe).not.toHaveBeenCalled()
    })

    it('blocks saving a package unit without a package quantity', async () => {
      const user = await renderForm(importedBurritoBowls)

      await user.selectOptions(screen.getAllByLabelText('Package unit')[1], 'POUND')
      await user.click(screen.getByRole('button', { name: 'Add Recipe' }))

      expect(screen.getAllByLabelText('Package quantity')[1]).toBeRequired()
      expect(screen.getAllByLabelText('Package quantity')[1]).toBeInvalid()
      expect(recipeApi.createRecipe).not.toHaveBeenCalled()
    })

    it('does not require either when both are empty', async () => {
      await renderForm()

      expect(screen.getByLabelText('Package quantity')).not.toBeRequired()
      expect(screen.getByLabelText('Package unit')).not.toBeRequired()
    })
  })

  describe('saving', () => {
    it('shows "Adding..." and disables the button while saving', async () => {
      let finish
      recipeApi.createRecipe.mockReturnValue(new Promise(resolve => { finish = resolve }))
      const user = await renderForm(importedBurritoBowls)

      await user.click(screen.getByRole('button', { name: 'Add Recipe' }))

      expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled()
      finish({ id: 7 })
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/recipe/7'))
    })

    it('shows the error and lets the user try again when saving fails', async () => {
      recipeApi.createRecipe.mockRejectedValueOnce(new Error('Failed to create recipe'))
      const user = await renderForm(importedBurritoBowls)

      await user.click(screen.getByRole('button', { name: 'Add Recipe' }))

      expect(await screen.findByText('Error: Failed to create recipe')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add Recipe' })).toBeEnabled()
      expect(screen.getByTestId('location')).toHaveTextContent('/recipe/new')
    })
  })

  describe('adding and removing rows', () => {
    it('adds and removes categories, keeping at least one', async () => {
      const user = await renderForm()
      const categories = section('Categories')

      expect(categories.getByRole('button', { name: 'Remove' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: '+ Add Category' }))
      await user.type(categories.getAllByRole('textbox')[1], 'Lunch')
      await user.click(categories.getAllByRole('button', { name: 'Remove' })[0])

      expect(values(categories.getAllByRole('textbox'))).toEqual(['Lunch'])
      expect(categories.getByRole('button', { name: 'Remove' })).toBeDisabled()
    })

    it('adds and removes equipment, keeping at least one', async () => {
      const user = await renderForm()
      const equipment = section('Equipment')

      await user.type(equipment.getByRole('textbox'), 'Skillet')
      await user.click(screen.getByRole('button', { name: '+ Add Equipment' }))
      await user.type(equipment.getAllByRole('textbox')[1], 'Spatula')
      await user.click(equipment.getAllByRole('button', { name: 'Remove' })[0])

      expect(values(equipment.getAllByRole('textbox'))).toEqual(['Spatula'])
      expect(equipment.getByRole('button', { name: 'Remove' })).toBeDisabled()
    })

    it('adds a blank ingredient row and removes a chosen one', async () => {
      const user = await renderForm(importedBurritoBowls)
      const ingredients = section('Ingredients *')

      await user.click(screen.getByRole('button', { name: '+ Add Ingredient' }))
      expect(values(screen.getAllByPlaceholderText('Ingredient name')))
        .toEqual(['corn kernels (drained)', 'uncooked long-grain white rice', ''])
      expect(values(screen.getAllByLabelText('Package unit'))).toEqual(['OUNCE', '', ''])

      await user.click(ingredients.getAllByRole('button', { name: 'Remove' })[0])
      expect(values(screen.getAllByPlaceholderText('Ingredient name')))
        .toEqual(['uncooked long-grain white rice', ''])
    })

    it('does not remove the last ingredient', async () => {
      await renderForm()

      expect(section('Ingredients *').getByRole('button', { name: 'Remove' })).toBeDisabled()
    })

    it('renumbers steps after one is removed, keeping at least one', async () => {
      const user = await renderForm()
      const steps = section('Instructions *')

      await user.type(screen.getByPlaceholderText('Instruction text'), 'First')
      await user.click(screen.getByRole('button', { name: '+ Add Step' }))
      await user.type(screen.getAllByPlaceholderText('Instruction text')[1], 'Second')
      expect(screen.getByText('Step 2')).toBeInTheDocument()

      await user.click(steps.getAllByRole('button', { name: 'Remove' })[0])

      expect(values(screen.getAllByPlaceholderText('Instruction text'))).toEqual(['Second'])
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.queryByText('Step 2')).not.toBeInTheDocument()
      expect(steps.getByRole('button', { name: 'Remove' })).toBeDisabled()
    })
  })

  describe('navigation', () => {
    it('Cancel goes back to the recipe list without saving', async () => {
      const user = await renderForm()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
      expect(recipeApi.createRecipe).not.toHaveBeenCalled()
    })

    it('"← Back to Recipes" goes back to the recipe list', async () => {
      const user = await renderForm()

      await user.click(screen.getByRole('button', { name: '← Back to Recipes' }))

      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    })
  })
})
