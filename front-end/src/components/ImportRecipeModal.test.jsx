import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportRecipeModal from './ImportRecipeModal'
import { recipeApi } from '../services/api'
import { importedBurritoBowls } from '../test/fixtures/recipes'

vi.mock('../services/api', () => ({
  recipeApi: { importRecipeFromUrl: vi.fn() },
}))

const URL = 'https://damndelicious.net/burrito-bowls/'

function renderModal(props = {}) {
  const onClose = vi.fn()
  const onImportSuccess = vi.fn()
  render(
    <ImportRecipeModal isOpen onClose={onClose} onImportSuccess={onImportSuccess} {...props} />
  )
  return { onClose, onImportSuccess, user: userEvent.setup() }
}

describe('ImportRecipeModal', () => {
  beforeEach(() => {
    recipeApi.importRecipeFromUrl.mockResolvedValue(importedBurritoBowls)
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <ImportRecipeModal isOpen={false} onClose={vi.fn()} onImportSuccess={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('disables Import until a URL is entered', async () => {
    const { user } = renderModal()

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), URL)
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it('imports the URL, closes, and hands the recipe to the parent', async () => {
    const { user, onClose, onImportSuccess } = renderModal()

    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), URL)
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(recipeApi.importRecipeFromUrl).toHaveBeenCalledWith(URL)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onImportSuccess).toHaveBeenCalledWith(importedBurritoBowls)
  })

  it('shows a loading state while the import is running', async () => {
    let finish
    recipeApi.importRecipeFromUrl.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const { user } = renderModal()

    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), URL)
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(screen.getByRole('button', { name: 'Importing...' })).toBeDisabled()
    expect(screen.getByPlaceholderText('https://example.com/recipe')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    finish(importedBurritoBowls)
    expect(await screen.findByRole('button', { name: 'Import' })).toBeInTheDocument()
  })

  it('shows the error and stays open when the import fails', async () => {
    recipeApi.importRecipeFromUrl.mockRejectedValue(new Error('Failed to import recipe'))
    const { user, onClose, onImportSuccess } = renderModal()

    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), URL)
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('Failed to import recipe')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(onImportSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it('uses a default message when the error has none', async () => {
    recipeApi.importRecipeFromUrl.mockRejectedValue(new Error(''))
    const { user } = renderModal()

    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), URL)
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('Failed to import recipe from URL')).toBeInTheDocument()
  })

  it('Cancel clears the form and closes', async () => {
    const { user, onClose } = renderModal()

    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), URL)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByPlaceholderText('https://example.com/recipe')).toHaveValue('')
  })

  it('closes when the backdrop is clicked but not when the dialog is clicked', async () => {
    const { user, onClose } = renderModal()

    await user.click(screen.getByRole('heading', { name: 'Import Recipe from URL' }))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(document.querySelector('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
