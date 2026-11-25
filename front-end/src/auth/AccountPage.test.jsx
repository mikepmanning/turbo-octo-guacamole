import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountPage from './AccountPage'
import { authApi } from '../services/api'
import { renderWithAuth } from '../test/renderWithAuth'

vi.mock('../services/api', () => ({
  authApi: { updateProfile: vi.fn(), changePassword: vi.fn() },
}))

const ada = { id: 1, email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-12-10' }

const renderPage = (overrides = {}) =>
  renderWithAuth(<AccountPage />, { route: '/account', user: ada, ...overrides })

const details = () => within(screen.getByRole('region', { name: 'Your details' }))
const passwords = () => within(screen.getByRole('region', { name: 'Change password' }))

const retype = async (user, input, value) => {
  await user.clear(input)
  if (value) await user.type(input, value)
}

describe('AccountPage – your details', () => {
  it('starts with the user\'s current details', () => {
    renderPage()

    expect(details().getByLabelText('First name')).toHaveValue('Ada')
    expect(details().getByLabelText('Last name')).toHaveValue('Lovelace')
    expect(details().getByLabelText('Email')).toHaveValue('ada@example.com')
    expect(details().getByLabelText('Date of birth')).toHaveValue('1990-12-10')
    expect(screen.getByRole('link', { name: '← Back to recipes' })).toHaveAttribute('href', '/')
  })

  it('saves the edited details and updates the logged-in user', async () => {
    const user = userEvent.setup()
    const updated = { ...ada, firstName: 'Augusta', email: 'augusta@example.com' }
    authApi.updateProfile.mockResolvedValue(updated)
    const { auth } = renderPage()

    await retype(user, details().getByLabelText('First name'), ' Augusta ')
    await retype(user, details().getByLabelText('Email'), 'augusta@example.com')
    await user.click(details().getByRole('button', { name: 'Save changes' }))

    expect(authApi.updateProfile).toHaveBeenCalledWith({
      firstName: 'Augusta', lastName: 'Lovelace', email: 'augusta@example.com', dateOfBirth: '1990-12-10',
    })
    expect(await details().findByRole('status')).toHaveTextContent('Your details were saved.')
    expect(auth.updateUser).toHaveBeenCalledWith(updated)
    expect(details().getByLabelText('First name')).toHaveValue('Augusta')
  })

  it('checks the fields before saving', async () => {
    const user = userEvent.setup()
    renderPage()

    await retype(user, details().getByLabelText('Last name'), '')
    await user.click(details().getByRole('button', { name: 'Save changes' }))

    expect(authApi.updateProfile).not.toHaveBeenCalled()
    expect(details().getByText('Last name is required')).toBeInTheDocument()
  })

  it('shows the server\'s message, e.g. an email someone else has', async () => {
    const user = userEvent.setup()
    authApi.updateProfile.mockRejectedValue(new Error('An account with this email already exists'))
    const { auth } = renderPage()

    await user.click(details().getByRole('button', { name: 'Save changes' }))

    expect(await details().findByRole('alert')).toHaveTextContent('An account with this email already exists')
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(details().getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('says it is saving while waiting', async () => {
    const user = userEvent.setup()
    authApi.updateProfile.mockReturnValue(new Promise(() => {}))
    renderPage()

    await user.click(details().getByRole('button', { name: 'Save changes' }))

    expect(details().getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })

  it('clears the saved notice once a field changes again', async () => {
    const user = userEvent.setup()
    authApi.updateProfile.mockResolvedValue(ada)
    renderPage()

    await user.click(details().getByRole('button', { name: 'Save changes' }))
    await details().findByRole('status')
    await user.type(details().getByLabelText('First name'), 'x')

    expect(details().queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('AccountPage – change password', () => {
  const fillIn = async (user, { current = 'correct horse', next = 'a new password', confirm = next } = {}) => {
    await retype(user, passwords().getByLabelText('Current password'), current)
    await retype(user, passwords().getByLabelText('New password'), next)
    await retype(user, passwords().getByLabelText('Confirm new password'), confirm)
    await user.click(passwords().getByRole('button', { name: 'Change password' }))
  }

  it('changes the password and empties the fields', async () => {
    const user = userEvent.setup()
    authApi.changePassword.mockResolvedValue()
    renderPage()

    await fillIn(user)

    expect(authApi.changePassword).toHaveBeenCalledWith('correct horse', 'a new password')
    expect(await passwords().findByRole('status')).toHaveTextContent('Your password was changed.')
    expect(passwords().getByLabelText('Current password')).toHaveValue('')
    expect(passwords().getByLabelText('New password')).toHaveValue('')
  })

  it('checks the new password before sending it', async () => {
    const user = userEvent.setup()
    renderPage()

    await fillIn(user, { next: 'short', confirm: 'other' })

    expect(authApi.changePassword).not.toHaveBeenCalled()
    expect(passwords().getByText('Password must be 8 to 72 characters')).toBeInTheDocument()
    expect(passwords().getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('shows a wrong current password next to that field', async () => {
    const user = userEvent.setup()
    authApi.changePassword.mockRejectedValue(Object.assign(new Error('Current password is incorrect'), {
      fieldErrors: { currentPassword: 'Current password is incorrect' },
    }))
    renderPage()

    await fillIn(user, { current: 'wrong password' })

    expect(await passwords().findByRole('alert')).toHaveTextContent('Please fix the highlighted fields.')
    expect(passwords().getByText('Current password is incorrect')).toBeInTheDocument()
    expect(passwords().getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows any other failure', async () => {
    const user = userEvent.setup()
    authApi.changePassword.mockRejectedValue(new Error('Could not change your password'))
    renderPage()

    await fillIn(user)

    expect(await passwords().findByRole('alert')).toHaveTextContent('Could not change your password')
  })
})
