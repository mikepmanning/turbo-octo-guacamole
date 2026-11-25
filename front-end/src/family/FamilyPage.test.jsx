import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FamilyPage from './FamilyPage'
import { familyApi } from '../services/api'
import { renderWithAuth } from '../test/renderWithAuth'
import { ada, ownedFamily, soloFamily, memberFamily } from '../test/fixtures/families'

vi.mock('../services/api', () => ({
  familyApi: {
    getMyFamily: vi.fn(),
    createFamily: vi.fn(),
    renameFamily: vi.fn(),
    deleteFamily: vi.fn(),
    newInviteCode: vi.fn(),
    revokeInviteCode: vi.fn(),
    joinFamily: vi.fn(),
    leaveFamily: vi.fn(),
    removeMember: vi.fn(),
    makeOwner: vi.fn(),
  },
}))

const renderPage = () => renderWithAuth(<FamilyPage />, { route: '/family', user: ada })

const region = (name) => within(screen.getByRole('region', { name }))
const findRegion = async (name) => within(await screen.findByRole('region', { name }))
const dialog = () => within(screen.getByRole('alertdialog'))

describe('FamilyPage – loading', () => {
  it('says it is loading, then shows the family', async () => {
    familyApi.getMyFamily.mockResolvedValue(ownedFamily)
    renderPage()

    expect(screen.getByText('Loading your family...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'The Lovelaces' })).toBeInTheDocument()
  })

  it('shows the error and tries again on Retry', async () => {
    const user = userEvent.setup()
    familyApi.getMyFamily.mockRejectedValueOnce(new Error('Failed to load your family'))
    familyApi.getMyFamily.mockResolvedValueOnce(null)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load your family')
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('region', { name: 'Create a family' })).toBeInTheDocument()
  })
})

describe('FamilyPage – not in a family', () => {
  beforeEach(() => {
    familyApi.getMyFamily.mockResolvedValue(null)
  })

  it('offers to create or join a family', async () => {
    renderPage()

    expect(await screen.findByRole('region', { name: 'Create a family' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Join a family' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Back to recipes' })).toHaveAttribute('href', '/')
  })

  it('creates a family and shows it with its invite code', async () => {
    const user = userEvent.setup()
    familyApi.createFamily.mockResolvedValue(soloFamily)
    renderPage()

    await user.type((await findRegion('Create a family')).getByLabelText('Family name'), ' The Lovelaces ')
    await user.click(region('Create a family').getByRole('button', { name: 'Create family' }))

    expect(familyApi.createFamily).toHaveBeenCalledWith('The Lovelaces')
    expect(await screen.findByRole('heading', { name: 'The Lovelaces' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('“The Lovelaces” was created.')
    expect(screen.getByLabelText('Current invite code')).toHaveTextContent('ABCD-2345')
  })

  it('needs a family name', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click((await findRegion('Create a family')).getByRole('button', { name: 'Create family' }))

    expect(familyApi.createFamily).not.toHaveBeenCalled()
    expect(region('Create a family').getByText('Family name is required')).toBeInTheDocument()
  })

  it('joins with a code', async () => {
    const user = userEvent.setup()
    familyApi.joinFamily.mockResolvedValue(memberFamily)
    renderPage()

    await user.type((await findRegion('Join a family')).getByLabelText('Invite code'), 'abcd-2345')
    await user.click(region('Join a family').getByRole('button', { name: 'Join family' }))

    expect(familyApi.joinFamily).toHaveBeenCalledWith('abcd-2345')
    expect(await screen.findByRole('status')).toHaveTextContent('You joined “The Lovelaces”.')
  })

  it('shows why a code did not work, and lets the user try again', async () => {
    const user = userEvent.setup()
    familyApi.joinFamily.mockRejectedValue(new Error("That invite code isn't valid. It may have been revoked: ask for a new one."))
    renderPage()

    await user.type((await findRegion('Join a family')).getByLabelText('Invite code'), 'WRONG')
    await user.click(region('Join a family').getByRole('button', { name: 'Join family' }))

    expect(await region('Join a family').findByRole('alert')).toHaveTextContent("That invite code isn't valid.")
    expect(region('Join a family').getByRole('button', { name: 'Join family' })).toBeEnabled()
  })

  it('puts a server field error next to the field', async () => {
    const user = userEvent.setup()
    familyApi.createFamily.mockRejectedValue(Object.assign(new Error('x'), {
      fieldErrors: { name: 'Family name must be at most 100 characters' },
    }))
    renderPage()

    await user.type((await findRegion('Create a family')).getByLabelText('Family name'), 'Long')
    await user.click(region('Create a family').getByRole('button', { name: 'Create family' }))

    expect(await region('Create a family').findByText('Family name must be at most 100 characters')).toBeInTheDocument()
  })

  it('needs a code to join', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click((await findRegion('Join a family')).getByRole('button', { name: 'Join family' }))

    expect(region('Join a family').getByText('Invite code is required')).toBeInTheDocument()
  })
})

describe('FamilyPage – the owner', () => {
  beforeEach(() => {
    familyApi.getMyFamily.mockResolvedValue(ownedFamily)
  })

  it('shows the members, owner first, marking the user and the owner', async () => {
    renderPage()

    const items = ((await findRegion('Members (2)')).getAllByRole('listitem'))
    expect(items[0]).toHaveTextContent('Ada Lovelace (you)Owner')
    expect(items[0]).toHaveTextContent('ada@example.com')
    expect(items[1]).toHaveTextContent('Grace Hopper')
    expect(within(items[0]).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows and copies the invite code', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderPage()

    expect(await screen.findByLabelText('Current invite code')).toHaveTextContent('ABCD-2345')
    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('ABCD-2345')
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('says nothing when copying is not allowed', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Copy' }))

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('renames the family', async () => {
    const user = userEvent.setup()
    familyApi.renameFamily.mockResolvedValue({ ...ownedFamily, name: 'Team Lovelace' })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    const name = screen.getByLabelText('Family name')
    expect(name).toHaveValue('The Lovelaces')
    await user.clear(name)
    await user.type(name, 'Team Lovelace')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(familyApi.renameFamily).toHaveBeenCalledWith('Team Lovelace')
    expect(await screen.findByRole('heading', { name: 'Team Lovelace' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The family name was saved.')
  })

  it('can cancel renaming', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'The Lovelaces' })).toBeInTheDocument()
    expect(familyApi.renameFamily).not.toHaveBeenCalled()
  })

  it('asks before replacing the code, then shows the new one', async () => {
    const user = userEvent.setup()
    familyApi.newInviteCode.mockResolvedValue({ ...ownedFamily, inviteCode: 'WXYZ6789' })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'New code' }))
    expect(dialog().getByText(/ABCD-2345, will stop working/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Create new code' }))

    expect(await screen.findByLabelText('Current invite code')).toHaveTextContent('WXYZ-6789')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The old one no longer works.')
  })

  it('revokes the code, then offers to create one without asking', async () => {
    const user = userEvent.setup()
    familyApi.revokeInviteCode.mockResolvedValue({ ...ownedFamily, inviteCode: null, inviteCodeCreatedAt: null })
    familyApi.newInviteCode.mockResolvedValue(ownedFamily)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Revoke code' }))
    await user.click(dialog().getByRole('button', { name: 'Revoke code' }))

    expect(await screen.findByText("There's no invite code right now, so nobody can join.")).toBeInTheDocument()
    expect(screen.queryByLabelText('Current invite code')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create invite code' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Current invite code')).toHaveTextContent('ABCD-2345')
  })

  it('shows a failure to create a code', async () => {
    const user = userEvent.setup()
    familyApi.getMyFamily.mockResolvedValue({ ...ownedFamily, inviteCode: null })
    familyApi.newInviteCode.mockRejectedValue(new Error('Could not create a new invite code'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Create invite code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create a new invite code')
  })

  it('removes a member after asking', async () => {
    const user = userEvent.setup()
    familyApi.removeMember.mockResolvedValue(soloFamily)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Grace Hopper' }))
    expect(dialog().getByRole('heading')).toHaveTextContent('Remove Grace Hopper?')
    await user.click(dialog().getByRole('button', { name: 'Remove' }))

    expect(familyApi.removeMember).toHaveBeenCalledWith(2)
    expect(await screen.findByRole('region', { name: 'Members (1)' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Grace Hopper was removed from the family.')
  })

  it('keeps the dialog open with the reason when an action fails', async () => {
    const user = userEvent.setup()
    familyApi.removeMember.mockRejectedValue(new Error("That person isn't in your family"))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove Grace Hopper' }))
    await user.click(dialog().getByRole('button', { name: 'Remove' }))

    expect(await dialog().findByRole('alert')).toHaveTextContent("That person isn't in your family")
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('makes another member the owner', async () => {
    const user = userEvent.setup()
    familyApi.makeOwner.mockResolvedValue(memberFamily)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Make Grace Hopper the owner' }))
    await user.click(dialog().getByRole('button', { name: 'Make owner' }))

    expect(familyApi.makeOwner).toHaveBeenCalledWith(2)
    expect(await screen.findByRole('status')).toHaveTextContent('Grace Hopper is now the owner.')
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
  })

  it('must hand over before leaving while others are in the family', async () => {
    renderPage()

    expect(await screen.findByText('To leave the family, make someone else the owner first.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave family' })).not.toBeInTheDocument()
  })

  it('deletes the family after asking, then offers to create or join one', async () => {
    const user = userEvent.setup()
    familyApi.deleteFamily.mockResolvedValue(null)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete family' }))
    expect(dialog().getByText(/its other member removed from it/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Delete family' }))

    expect(await screen.findByRole('region', { name: 'Create a family' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('“The Lovelaces” was deleted.')
  })
})

describe('FamilyPage – the only member', () => {
  it('can leave, which deletes the family', async () => {
    const user = userEvent.setup()
    familyApi.getMyFamily.mockResolvedValue(soloFamily)
    familyApi.leaveFamily.mockResolvedValue(null)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Leave family' }))
    expect(dialog().getByText(/You are the only member/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Leave family' }))

    expect(await screen.findByRole('status')).toHaveTextContent('You left “The Lovelaces”.')
  })

  it('is warned that deleting cannot be undone', async () => {
    const user = userEvent.setup()
    familyApi.getMyFamily.mockResolvedValue(soloFamily)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete family' }))

    expect(dialog().getByText('“The Lovelaces” will be deleted. This can\'t be undone.')).toBeInTheDocument()
  })
})

describe('FamilyPage – a member', () => {
  beforeEach(() => {
    familyApi.getMyFamily.mockResolvedValue(memberFamily)
  })

  it('sees the members but cannot manage the family', async () => {
    renderPage()

    expect(await screen.findByText("To invite someone, ask Grace Hopper for the family's invite code.")).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Invite code' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete family' })).not.toBeInTheDocument()
  })

  it('leaves the family after asking', async () => {
    const user = userEvent.setup()
    familyApi.leaveFamily.mockResolvedValue(null)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Leave family' }))
    expect(dialog().getByText(/You can join again with an invite code/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Leave family' }))

    expect(familyApi.leaveFamily).toHaveBeenCalled()
    expect(await screen.findByRole('region', { name: 'Join a family' })).toBeInTheDocument()
  })
})
