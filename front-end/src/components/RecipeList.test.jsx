import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeList from './RecipeList'
import { recipeApi } from '../services/api'
import { renderWithRouter } from '../test/renderWithRouter'
import { importedBurritoBowls, savedBurritoBowls } from '../test/fixtures/recipes'

vi.mock('../services/api', () => ({
  recipeApi: { getAllRecipes: vi.fn(), importRecipeFromUrl: vi.fn(), deleteRecipes: vi.fn(), setExcludedFromMealPlans: vi.fn() },
}))

const renderList = () => renderWithRouter(<RecipeList />, { path: '/', route: '/' })

// Select is there from the start, but disabled until there are recipes to select.
const selectButtonWhenReady = async () => {
  const button = screen.getByRole('button', { name: 'Select' })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

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

  describe('after a recipe is deleted', () => {
    const renderAfterDelete = () => renderWithRouter(<RecipeList />, {
      path: '/', route: '/', state: { deletedRecipeTitle: 'Weeknight Chili' },
    })

    it('says which recipe was deleted', async () => {
      recipeApi.getAllRecipes.mockResolvedValue([savedBurritoBowls])
      renderAfterDelete()

      expect(screen.getByRole('status')).toHaveTextContent('“Weeknight Chili” was deleted.')
      await screen.findByRole('link', { name: /Instant Pot Chicken Burrito Bowls/ })
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('clears the message from the history, so a reload does not repeat it', async () => {
      recipeApi.getAllRecipes.mockResolvedValue([])
      renderAfterDelete()

      await waitFor(() => expect(screen.getByTestId('location').dataset.state).toBe('null'))
      expect(screen.getByRole('status')).toHaveTextContent('“Weeknight Chili” was deleted.')
      expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(1)
    })

    it('says nothing on a normal visit', async () => {
      recipeApi.getAllRecipes.mockResolvedValue([])
      renderList()

      await screen.findByText('No recipes found. Create your first recipe!')
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  it('always links to the saved meal plans', async () => {
    recipeApi.getAllRecipes.mockResolvedValue([])
    renderList()

    expect(screen.getByRole('link', { name: 'Meal Plans' })).toHaveAttribute('href', '/meal-plans')
    await screen.findByText(/No recipes found/)
    expect(screen.getByRole('link', { name: 'Meal Plans' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Plan Meals' })).not.toBeInTheDocument()   // on the Meal Plans page
  })

  describe('excluding recipes from meal plans', () => {
    const RECIPES = [
      { id: 1, title: 'Pancakes', description: '', totalTimeMinutes: 10, servings: 2, categories: [], excludedFromMealPlans: true },
      { id: 2, title: 'Waffles', description: '', totalTimeMinutes: 10, servings: 2, categories: [] },
      { id: 3, title: 'Crepes', description: '', totalTimeMinutes: 10, servings: 2, categories: [] },
    ]
    const card = (title) => screen.getByRole('checkbox', { name: title }).closest('.recipe-card')
    const bar = (name) => screen.getByRole('button', { name })

    beforeEach(() => {
      recipeApi.getAllRecipes.mockResolvedValue(RECIPES)
    })

    async function selectRecipes(titles) {
      const user = userEvent.setup()
      renderList()
      await user.click(await selectButtonWhenReady())
      for (const title of titles) await user.click(card(title))
      return user
    }

    it('tags the cards of excluded recipes', async () => {
      renderList()

      const pancakes = await screen.findByRole('link', { name: /Pancakes/ })
      expect(within(pancakes).getByText('Not in meal plans')).toBeInTheDocument()
      expect(within(screen.getByRole('link', { name: /Waffles/ })).queryByText('Not in meal plans')).not.toBeInTheDocument()
    })

    it('offers Exclude and Include in Select mode, once something is selected', async () => {
      const user = await selectRecipes([])

      expect(bar('Exclude from meal plans')).toBeDisabled()
      expect(bar('Include in meal plans')).toBeDisabled()
      await user.click(card('Waffles'))
      expect(bar('Exclude from meal plans')).toBeEnabled()
      expect(bar('Include in meal plans')).toBeEnabled()
    })

    it('excludes the selection, then shows the refreshed list and what happened', async () => {
      let finish
      recipeApi.setExcludedFromMealPlans.mockReturnValue(new Promise(resolve => { finish = resolve }))
      const user = await selectRecipes(['Crepes', 'Waffles'])

      await user.click(bar('Exclude from meal plans'))

      expect(recipeApi.setExcludedFromMealPlans).toHaveBeenCalledWith([2, 3], true)   // list order
      expect(bar('Exclude from meal plans')).toBeDisabled()
      expect(bar('Include in meal plans')).toBeDisabled()
      recipeApi.getAllRecipes.mockResolvedValue(RECIPES.map(r => ({ ...r, excludedFromMealPlans: true })))
      finish({ updatedIds: [2, 3] })

      expect(await screen.findByRole('status')).toHaveTextContent('2 recipes excluded from meal plans.')
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()   // Select mode has ended
      await waitFor(() => expect(screen.getAllByText('Not in meal plans')).toHaveLength(3))
      expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(2)
    })

    it('includes the selection again', async () => {
      recipeApi.setExcludedFromMealPlans.mockResolvedValue({ updatedIds: [1] })
      const user = await selectRecipes(['Pancakes'])

      await user.click(bar('Include in meal plans'))

      expect(recipeApi.setExcludedFromMealPlans).toHaveBeenCalledWith([1], false)
      expect(await screen.findByRole('status')).toHaveTextContent('1 recipe included in meal plans.')
    })

    it('says so when the selected recipes had been deleted meanwhile', async () => {
      recipeApi.setExcludedFromMealPlans.mockResolvedValue({ updatedIds: [] })
      const user = await selectRecipes(['Waffles'])

      await user.click(bar('Exclude from meal plans'))

      expect(await screen.findByRole('status')).toHaveTextContent('Those recipes had already been deleted.')
    })

    it('when it fails, says why and keeps the selection to try again', async () => {
      recipeApi.setExcludedFromMealPlans.mockRejectedValue(new Error('Failed to update meal plan settings'))
      const user = await selectRecipes(['Waffles'])

      await user.click(bar('Exclude from meal plans'))

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update meal plan settings')
      expect(screen.getByRole('checkbox', { name: 'Waffles' })).toBeChecked()
      expect(bar('Exclude from meal plans')).toBeEnabled()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('the Filters panel can show only the excluded recipes', async () => {
      const user = userEvent.setup()
      renderList()
      await screen.findByRole('link', { name: /Pancakes/ })

      await user.click(screen.getByRole('button', { name: /Filters/ }))
      await user.click(screen.getByRole('checkbox', { name: 'Only recipes excluded from meal plans' }))

      expect(screen.getByRole('link', { name: /Pancakes/ })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Waffles/ })).not.toBeInTheDocument()
      expect(screen.getByText('Showing 1 of 3 recipes')).toBeInTheDocument()
    })
  })

  describe('selecting recipes to delete', () => {
    const TITLES = ['Pancakes', 'Waffles', 'Crepes', 'Omelette', 'Porridge', 'Granola', 'Toast']
    const RECIPES = TITLES.map((title, i) => ({
      id: i + 1, title, description: `${title}.`, totalTimeMinutes: 10, servings: 2, categories: [],
    }))
    const checkbox = (title) => screen.getByRole('checkbox', { name: title })
    const card = (title) => checkbox(title).closest('.recipe-card')

    beforeEach(() => {
      recipeApi.getAllRecipes.mockResolvedValue(RECIPES)
    })

    async function startSelecting() {
      const user = userEvent.setup()
      renderList()
      await user.click(await selectButtonWhenReady())
      return user
    }

    async function selectAndOpenDialog(user, titles) {
      for (const title of titles) await user.click(card(title))
      await user.click(screen.getByRole('button', { name: `Delete (${titles.length})` }))
      return within(screen.getByRole('alertdialog'))
    }

    it('shows Select from the start, usable once there are recipes', async () => {
      renderList()

      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled()   // while loading
      await screen.findByRole('link', { name: /Pancakes/ })
      expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled()
    })

    it('keeps Select disabled when there are no recipes, or they did not load', async () => {
      recipeApi.getAllRecipes.mockResolvedValueOnce([])
      const { unmount } = renderList()
      await screen.findByText(/No recipes found/)
      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled()
      unmount()

      recipeApi.getAllRecipes.mockRejectedValueOnce(new Error('Failed to fetch recipes'))
      renderList()
      await screen.findByText('Error: Failed to fetch recipes')
      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled()
    })

    it('turns cards into checkboxes, with nothing selected yet', async () => {
      await startSelecting()

      expect(screen.getByText('0 selected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete (0)' })).toBeDisabled()
      expect(screen.getAllByRole('checkbox')).toHaveLength(7)
      expect(screen.getAllByRole('checkbox').every(box => !box.checked)).toBe(true)
      expect(screen.queryByRole('link', { name: /Pancakes/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument()
    })

    it('clicking a card selects it instead of opening it; clicking again deselects', async () => {
      const user = await startSelecting()

      await user.click(screen.getByRole('heading', { name: 'Waffles' }))
      expect(checkbox('Waffles')).toBeChecked()
      expect(card('Waffles')).toHaveClass('selected')
      expect(screen.getByText('1 selected')).toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)

      await user.click(card('Waffles'))
      expect(checkbox('Waffles')).not.toBeChecked()
      expect(screen.getByText('0 selected')).toBeInTheDocument()
    })

    it('the checkbox itself toggles once, and works from the keyboard', async () => {
      const user = await startSelecting()

      await user.click(checkbox('Crepes'))
      expect(checkbox('Crepes')).toBeChecked()

      checkbox('Toast').focus()
      await user.keyboard(' ')
      expect(checkbox('Toast')).toBeChecked()
      expect(screen.getByText('2 selected')).toBeInTheDocument()
    })

    it('Select all and Clear', async () => {
      const user = await startSelecting()

      expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Select all' }))
      expect(screen.getByText('7 selected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Clear' }))
      expect(screen.getByText('0 selected')).toBeInTheDocument()
    })

    it.each([
      ['Cancel', (user) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
      ['Escape', (user) => user.keyboard('{Escape}')],
    ])('%s leaves selection mode and forgets the selection', async (_, leave) => {
      const user = await startSelecting()
      await user.click(card('Pancakes'))

      await leave(user)

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Pancakes/ })).toHaveAttribute('href', '/recipe/1')
      await user.click(screen.getByRole('button', { name: 'Select' }))
      expect(screen.getByText('0 selected')).toBeInTheDocument()
    })

    it('asks for confirmation, listing the selected recipes in list order', async () => {
      const user = await startSelecting()

      const dialog = await selectAndOpenDialog(user, ['Crepes', 'Pancakes'])

      expect(screen.getByRole('alertdialog', { name: 'Delete 2 recipes?' })).toBeInTheDocument()
      expect(dialog.getByText('These recipes will be removed from your collection:')).toBeInTheDocument()
      expect(dialog.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Pancakes', 'Crepes'])
      expect(dialog.getByRole('button', { name: 'Delete 2 recipes' })).toBeInTheDocument()
      expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(recipeApi.deleteRecipes).not.toHaveBeenCalled()
    })

    it('uses singular wording for one recipe', async () => {
      const user = await startSelecting()

      const dialog = await selectAndOpenDialog(user, ['Toast'])

      expect(screen.getByRole('alertdialog', { name: 'Delete 1 recipe?' })).toBeInTheDocument()
      expect(dialog.getByText('This recipe will be removed from your collection:')).toBeInTheDocument()
      expect(dialog.getByRole('button', { name: 'Delete 1 recipe' })).toBeInTheDocument()
    })

    it('lists five titles, then "…and N more"', async () => {
      const user = await startSelecting()
      await user.click(screen.getByRole('button', { name: 'Select all' }))
      await user.click(screen.getByRole('button', { name: 'Delete (7)' }))

      const items = within(screen.getByRole('alertdialog')).getAllByRole('listitem').map(li => li.textContent)
      expect(items).toEqual(['Pancakes', 'Waffles', 'Crepes', 'Omelette', 'Porridge', '…and 2 more'])
    })

    it('Cancel in the dialog keeps the selection and returns focus to Delete', async () => {
      const user = await startSelecting()
      const dialog = await selectAndOpenDialog(user, ['Waffles', 'Toast'])

      await user.click(dialog.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByText('2 selected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete (2)' })).toHaveFocus()
    })

    it('Escape in the dialog closes only the dialog', async () => {
      const user = await startSelecting()
      await selectAndOpenDialog(user, ['Waffles'])

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(checkbox('Waffles')).toBeChecked()
    })

    it('deletes the selection in one request, then shows the refreshed list and what happened', async () => {
      const user = await startSelecting()
      const dialog = await selectAndOpenDialog(user, ['Crepes', 'Pancakes'])
      recipeApi.deleteRecipes.mockResolvedValue({ deletedIds: [1, 3] })
      recipeApi.getAllRecipes.mockResolvedValue(RECIPES.filter(r => ![1, 3].includes(r.id)))

      await user.click(dialog.getByRole('button', { name: 'Delete 2 recipes' }))

      expect(recipeApi.deleteRecipes).toHaveBeenCalledWith([1, 3])
      expect(await screen.findByRole('status')).toHaveTextContent('Deleted 2 recipes.')
      await waitFor(() => expect(screen.queryByRole('link', { name: /Pancakes/ })).not.toBeInTheDocument())
      expect(screen.getAllByRole('link', { name: /./ }).map(a => a.getAttribute('href')))
        .toEqual(['/recipe/new', '/meal-plans', '/recipe/2', '/recipe/4', '/recipe/5', '/recipe/6', '/recipe/7'])
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByText('Loading recipes...')).not.toBeInTheDocument()
      expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(2)
    })

    it.each([
      { deletedIds: [2], selected: ['Waffles', 'Toast'], notice: 'Deleted 1 recipe. 1 had already been deleted.' },
      { deletedIds: [], selected: ['Waffles', 'Toast'], notice: 'Those recipes had already been deleted.' },
      { deletedIds: [], selected: ['Toast'], notice: 'That recipe had already been deleted.' },
    ])('says "$notice" when the server deleted $deletedIds.length of $selected.length', async ({ deletedIds, selected, notice }) => {
      const user = await startSelecting()
      const dialog = await selectAndOpenDialog(user, selected)
      recipeApi.deleteRecipes.mockResolvedValue({ deletedIds })

      await user.click(dialog.getByRole('button', { name: /^Delete \d/ }))

      expect(await screen.findByRole('status')).toHaveTextContent(notice)
    })

    it('shows "Deleting..." and locks the dialog while deleting', async () => {
      let finish
      recipeApi.deleteRecipes.mockReturnValue(new Promise(resolve => { finish = resolve }))
      const user = await startSelecting()
      const dialog = await selectAndOpenDialog(user, ['Waffles'])

      await user.click(dialog.getByRole('button', { name: 'Delete 1 recipe' }))

      expect(dialog.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
      expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      finish({ deletedIds: [2] })
      expect(await screen.findByRole('status')).toHaveTextContent('Deleted 1 recipe.')
    })

    it('when deleting fails, shows why in the dialog and keeps the selection to retry', async () => {
      recipeApi.deleteRecipes.mockRejectedValueOnce(new Error('Failed to delete recipes: database went away'))
      const user = await startSelecting()
      const dialog = await selectAndOpenDialog(user, ['Waffles', 'Toast'])

      await user.click(dialog.getByRole('button', { name: 'Delete 2 recipes' }))

      expect(await dialog.findByRole('alert')).toHaveTextContent('Failed to delete recipes: database went away')
      expect(dialog.getByRole('button', { name: 'Delete 2 recipes' })).toBeEnabled()
      expect(checkbox('Waffles')).toBeChecked()
      expect(checkbox('Toast')).toBeChecked()

      recipeApi.deleteRecipes.mockResolvedValue({ deletedIds: [2, 7] })
      await user.click(dialog.getByRole('button', { name: 'Delete 2 recipes' }))
      expect(await screen.findByRole('status')).toHaveTextContent('Deleted 2 recipes.')
      expect(recipeApi.deleteRecipes).toHaveBeenLastCalledWith([2, 7])
    })

    it('scrolls the result into view (the bar may be far down the page)', async () => {
      const scrolledTo = []
      Element.prototype.scrollIntoView = function () { scrolledTo.push(this.textContent) }
      try {
        recipeApi.deleteRecipes.mockResolvedValue({ deletedIds: [2] })
        const user = await startSelecting()
        const dialog = await selectAndOpenDialog(user, ['Waffles'])

        await user.click(dialog.getByRole('button', { name: 'Delete 1 recipe' }))

        await waitFor(() => expect(scrolledTo).toEqual(['Deleted 1 recipe.']))
      } finally {
        delete Element.prototype.scrollIntoView
      }
    })

    it('clears an old notice when selecting starts', async () => {
      const user = userEvent.setup()
      renderWithRouter(<RecipeList />, { path: '/', route: '/', state: { deletedRecipeTitle: 'Weeknight Chili' } })
      expect(screen.getByRole('status')).toBeInTheDocument()

      await user.click(await selectButtonWhenReady())

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('searching', () => {
    const RECIPES = [
      { id: 1, title: 'Weeknight Chili', categories: ['Dinner', 'Mexican'],
        ingredients: [{ name: 'ground beef' }, { name: 'kidney beans' }],
        prepTimeMinutes: 10, cookTimeMinutes: 30, totalTimeMinutes: 40, servings: 4 },
      { id: 2, title: 'Chicken Noodle Soup', categories: ['Soup', 'Dinner'],
        ingredients: [{ name: 'chicken thighs' }, { name: 'egg noodles' }],
        prepTimeMinutes: 15, cookTimeMinutes: 25, totalTimeMinutes: 40, servings: 6 },
      { id: 3, title: 'Miso Soup', categories: ['Soup', 'Japanese', 'Vegan'],
        ingredients: [{ name: 'silken tofu' }, { name: 'white miso' }],
        prepTimeMinutes: 5, cookTimeMinutes: 10, totalTimeMinutes: 15, servings: 4 },
      { id: 4, title: 'Crème Brûlée', categories: ['Dessert', 'French'],
        ingredients: [{ name: 'heavy cream' }, { name: 'egg yolks' }],
        prepTimeMinutes: 20, cookTimeMinutes: 40, totalTimeMinutes: 300, servings: 6 },
      { id: 5, title: 'Chicken Tikka Masala', categories: ['Dinner', 'Indian'],
        ingredients: [{ name: 'chicken thighs' }, { name: 'yogurt' }],
        prepTimeMinutes: 20, cookTimeMinutes: 40, totalTimeMinutes: 240, servings: 6 },
      { id: 6, title: 'House Vinaigrette', categories: [], ingredients: [{ name: 'olive oil' }] },
    ]

    const shownTitles = () =>
      [...document.querySelectorAll('.recipe-grid h2')].map(h2 => h2.textContent)
    const chips = () =>
      within(screen.getByRole('list', { name: 'Active filters' })).getAllByRole('listitem').map(li => li.textContent)

    beforeEach(() => {
      recipeApi.getAllRecipes.mockResolvedValue(RECIPES)
    })

    async function renderLoaded() {
      const user = userEvent.setup()
      renderList()
      await screen.findByRole('heading', { name: 'Weeknight Chili' })
      return user
    }

    async function openFilters(user) {
      await user.click(screen.getByRole('button', { name: /^Filters/ }))
    }

    it('is there from the start, even with no recipes', async () => {
      recipeApi.getAllRecipes.mockResolvedValue([])
      renderList()

      expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toBeInTheDocument()   // while loading
      await screen.findByText('No recipes found. Create your first recipe!')
      expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toBeInTheDocument()
    })

    it('can be typed in while the recipes load, and applies once they arrive', async () => {
      const user = userEvent.setup()
      let finishLoading
      recipeApi.getAllRecipes.mockReturnValue(new Promise(resolve => { finishLoading = resolve }))
      renderList()

      await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'soup')
      expect(screen.getByText('Loading recipes...')).toBeInTheDocument()
      finishLoading(RECIPES)

      await screen.findByText('Showing 2 of 6 recipes')
      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Miso Soup'])
    })

    it('shows every recipe, with no summary, until something is searched', async () => {
      await renderLoaded()

      expect(shownTitles()).toHaveLength(6)
      expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument()
    })

    it('filters as you type, and says how many match', async () => {
      const user = await renderLoaded()

      await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'soup')

      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Miso Soup'])
      expect(screen.getByText('Showing 2 of 6 recipes')).toBeInTheDocument()
      expect(chips()).toEqual(['Search: soup✕'])
      expect(recipeApi.getAllRecipes).toHaveBeenCalledTimes(1)   // no extra requests
    })

    it('the search box looks at the whole recipe, not just the title', async () => {
      const user = await renderLoaded()
      const box = screen.getByRole('searchbox', { name: 'Search recipes' })

      await user.type(box, 'yogurt')                 // an ingredient
      expect(shownTitles()).toEqual(['Chicken Tikka Masala'])
      await user.clear(box)
      await user.type(box, 'vegan')                  // a category
      expect(shownTitles()).toEqual(['Miso Soup'])
      await user.clear(box)
      await user.type(box, 'egg dinner')             // every word, anywhere
      expect(shownTitles()).toEqual(['Chicken Noodle Soup'])
    })

    it('notes on the card when the match is in something the card doesn\'t show', async () => {
      const user = await renderLoaded()

      await user.type(screen.getByRole('searchbox'), 'chicken')

      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Chicken Tikka Masala'])
      expect(document.querySelectorAll('.match-note')).toHaveLength(0)   // "chicken" is in both titles

      await user.clear(screen.getByRole('searchbox'))
      await user.type(screen.getByRole('searchbox'), 'yogurt')
      const card = screen.getByRole('link', { name: /Chicken Tikka Masala/ })
      expect(within(card).getByText('Matches ingredient: yogurt')).toHaveClass('match-note')
    })

    it('notes the ingredient filter\'s matches too, and drops the notes when the search is cleared', async () => {
      const user = await renderLoaded()
      await openFilters(user)

      await user.type(screen.getByLabelText('Ingredient'), 'egg')

      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Crème Brûlée'])
      expect([...document.querySelectorAll('.match-note')].map(p => p.textContent))
        .toEqual(['Matches ingredient: egg noodles', 'Matches ingredient: egg yolks'])

      await user.click(screen.getByRole('button', { name: 'Clear all' }))
      expect(document.querySelectorAll('.match-note')).toHaveLength(0)
    })

    it('shows the notes in select mode too', async () => {
      const user = await renderLoaded()
      await user.type(screen.getByRole('searchbox'), 'tofu')
      await user.click(screen.getByRole('button', { name: 'Select' }))

      expect(within(screen.getByRole('checkbox', { name: 'Miso Soup' }).closest('.recipe-card'))
        .getByText('Matches ingredient: silken tofu')).toBeInTheDocument()
    })

    it('combines category, ingredient, and time filters', async () => {
      const user = await renderLoaded()
      await openFilters(user)

      await user.type(screen.getByLabelText('Category'), 'dinner')
      expect(shownTitles()).toEqual(['Weeknight Chili', 'Chicken Noodle Soup', 'Chicken Tikka Masala'])
      await user.type(screen.getByLabelText('Ingredient'), 'chicken')
      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Chicken Tikka Masala'])
      await user.type(screen.getByLabelText('Max total (min)'), '60')
      expect(shownTitles()).toEqual(['Chicken Noodle Soup'])

      expect(chips()).toEqual(['Category: dinner✕', 'Ingredient: chicken✕', 'Max total: 60 min✕'])
      expect(screen.getByText('Showing 1 of 6 recipes')).toBeInTheDocument()
    })

    it('filters by prep and cook time', async () => {
      const user = await renderLoaded()
      await openFilters(user)

      await user.type(screen.getByLabelText('Max prep (min)'), '15')
      expect(shownTitles()).toEqual(['Weeknight Chili', 'Chicken Noodle Soup', 'Miso Soup'])
      await user.type(screen.getByLabelText('Max cook (min)'), '25')
      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Miso Soup'])
    })

    it('a chip\'s ✕ removes that filter and widens the results', async () => {
      const user = await renderLoaded()
      await openFilters(user)
      await user.type(screen.getByLabelText('Ingredient'), 'chicken')
      await user.type(screen.getByLabelText('Max total (min)'), '60')

      await user.click(screen.getByRole('button', { name: 'Remove Max total filter' }))

      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Chicken Tikka Masala'])
      expect(screen.getByLabelText('Max total (min)')).toHaveValue(null)
      expect(chips()).toEqual(['Ingredient: chicken✕'])
    })

    it('editing a value in place updates the results and its chip', async () => {
      const user = await renderLoaded()
      const box = screen.getByRole('searchbox', { name: 'Search recipes' })
      await user.type(box, 'soup')

      await user.clear(box)
      await user.type(box, 'chicken')

      expect(shownTitles()).toEqual(['Chicken Noodle Soup', 'Chicken Tikka Masala'])
      expect(chips()).toEqual(['Search: chicken✕'])
    })

    it('Clear all shows every recipe again', async () => {
      const user = await renderLoaded()
      await user.type(screen.getByRole('searchbox'), 'soup')

      await user.click(screen.getByRole('button', { name: 'Clear all' }))

      expect(shownTitles()).toHaveLength(6)
      expect(screen.getByRole('searchbox')).toHaveValue('')
      expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument()
    })

    it('says "No recipes match your search." when nothing does, with a way to clear it', async () => {
      const user = await renderLoaded()

      await user.type(screen.getByRole('searchbox'), 'pizza')

      expect(screen.getByText('No recipes match your search.')).toBeInTheDocument()
      expect(shownTitles()).toEqual([])
      expect(screen.queryByText(/No recipes found/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled()
      expect(chips()).toEqual(['Search: pizza✕'])

      await user.click(screen.getByRole('button', { name: 'Clear search' }))

      expect(shownTitles()).toHaveLength(6)
      expect(screen.queryByText('No recipes match your search.')).not.toBeInTheDocument()
      expect(screen.getByRole('searchbox')).toHaveFocus()
    })

    it('no match also covers a recipe with no times when a time filter is set', async () => {
      const user = await renderLoaded()
      await user.type(screen.getByRole('searchbox'), 'vinaigrette')
      expect(shownTitles()).toEqual(['House Vinaigrette'])

      await openFilters(user)
      await user.type(screen.getByLabelText('Max total (min)'), '999')

      expect(screen.getByText('No recipes match your search.')).toBeInTheDocument()
    })

    describe('with Select', () => {
      it('Select all selects only the recipes that match, and only they are deleted', async () => {
        recipeApi.deleteRecipes.mockResolvedValue({ deletedIds: [2, 3] })
        const user = await renderLoaded()
        await user.type(screen.getByRole('searchbox'), 'soup')
        await user.click(screen.getByRole('button', { name: 'Select' }))

        await user.click(screen.getByRole('button', { name: 'Select all' }))
        expect(screen.getByText('2 selected')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Delete (2)' }))
        const dialog = within(screen.getByRole('alertdialog'))
        expect(dialog.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Chicken Noodle Soup', 'Miso Soup'])
        await user.click(dialog.getByRole('button', { name: 'Delete 2 recipes' }))

        expect(recipeApi.deleteRecipes).toHaveBeenCalledWith([2, 3])
      })

      it('narrowing the search drops selected recipes it hides', async () => {
        const user = await renderLoaded()
        await user.click(screen.getByRole('button', { name: 'Select' }))
        await user.click(screen.getByRole('checkbox', { name: 'Weeknight Chili' }))
        await user.click(screen.getByRole('checkbox', { name: 'Miso Soup' }))
        expect(screen.getByText('2 selected')).toBeInTheDocument()

        await user.type(screen.getByRole('searchbox'), 'soup')
        expect(screen.getByText('1 selected')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Clear all' }))
        expect(screen.getByRole('checkbox', { name: 'Weeknight Chili' })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Miso Soup' })).toBeChecked()
        expect(screen.getByText('1 selected')).toBeInTheDocument()
      })

      it('keeps the search after deleting, applied to the refreshed list', async () => {
        recipeApi.deleteRecipes.mockResolvedValue({ deletedIds: [3] })
        const user = await renderLoaded()
        await user.type(screen.getByRole('searchbox'), 'soup')
        await user.click(screen.getByRole('button', { name: 'Select' }))
        await user.click(screen.getByRole('checkbox', { name: 'Miso Soup' }))
        await user.click(screen.getByRole('button', { name: 'Delete (1)' }))
        recipeApi.getAllRecipes.mockResolvedValue(RECIPES.filter(r => r.id !== 3))

        await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete 1 recipe' }))

        expect(await screen.findByText('Showing 1 of 5 recipes')).toBeInTheDocument()
        expect(shownTitles()).toEqual(['Chicken Noodle Soup'])
        expect(screen.getByRole('searchbox')).toHaveValue('soup')
      })
    })
  })
})
