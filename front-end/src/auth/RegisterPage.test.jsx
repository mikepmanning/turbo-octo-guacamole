import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPage from './RegisterPage'
import { validateAccount } from './accountRules'
import { renderWithAuth } from '../test/renderWithAuth'

const ada = { id: 1, firstName: 'Ada', lastName: 'Lovelace' }

const fillIn = async (user, overrides = {}) => {
  const values = {
    'First name': ' Ada ',
    'Last name': 'Lovelace',
    Email: 'ada@example.com',
    'Date of birth': '1990-12-10',
    Password: 'correct horse',
    'Confirm password': 'correct horse',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label)
    await user.clear(input)
    if (value) await user.type(input, value)
  }
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('RegisterPage', () => {
  it('creates the account with every field and goes to the recipe list', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithAuth(<RegisterPage />, { route: '/register', register: vi.fn().mockResolvedValue(ada) })

    await fillIn(user)

    expect(auth.register).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      dateOfBirth: '1990-12-10',
      password: 'correct horse',
    })
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })

  it('checks the fields before sending anything', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithAuth(<RegisterPage />, { route: '/register' })

    await fillIn(user, { 'First name': '', Password: 'short', 'Confirm password': 'different' })

    expect(auth.register).not.toHaveBeenCalled()
    expect(screen.getByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Password must be 8 to 72 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears a field\'s error once it is changed', async () => {
    const user = userEvent.setup()
    renderWithAuth(<RegisterPage />, { route: '/register' })

    await fillIn(user, { 'First name': '' })
    await user.type(screen.getByLabelText('First name'), 'A')

    expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
  })

  it('shows the server\'s message, e.g. an email already registered', async () => {
    const user = userEvent.setup()
    const register = vi.fn().mockRejectedValue(new Error('An account with this email already exists'))
    renderWithAuth(<RegisterPage />, { route: '/register', register })

    await fillIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  it('puts the server\'s field errors next to the fields', async () => {
    const user = userEvent.setup()
    const error = Object.assign(new Error('Enter a valid email address'), {
      fieldErrors: { email: 'Enter a valid email address' },
    })
    renderWithAuth(<RegisterPage />, { route: '/register', register: vi.fn().mockRejectedValue(error) })

    await fillIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Please fix the highlighted fields.')
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('links back to logging in', () => {
    renderWithAuth(<RegisterPage />, { route: '/register' })

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('sends someone already logged in straight on', () => {
    renderWithAuth(<RegisterPage />, { route: '/register', user: ada })

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })
})

describe('validateAccount', () => {
  const valid = {
    firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', dateOfBirth: '1990-12-10',
    password: 'correct horse', confirmPassword: 'correct horse',
  }

  it('accepts a complete account', () => {
    expect(validateAccount(valid, '2026-11-24')).toEqual({})
  })

  it('needs every field', () => {
    const empty = { firstName: ' ', lastName: '', email: '', dateOfBirth: '', password: '', confirmPassword: '' }
    expect(Object.keys(validateAccount(empty, '2026-11-24')).sort())
      .toEqual(['dateOfBirth', 'email', 'firstName', 'lastName', 'password'])
  })

  it('needs a date of birth before today', () => {
    expect(validateAccount({ ...valid, dateOfBirth: '2026-11-24' }, '2026-11-24').dateOfBirth)
      .toBe('Date of birth must be in the past')
  })

  it('refuses passwords over 72 characters', () => {
    const long = 'x'.repeat(73)
    expect(validateAccount({ ...valid, password: long, confirmPassword: long }, '2026-11-24').password)
      .toBe('Password must be 8 to 72 characters')
  })
})
