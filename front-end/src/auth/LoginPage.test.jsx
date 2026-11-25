import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import { destinationAfterLogin } from './accountRules'
import { renderWithAuth } from '../test/renderWithAuth'

const ada = { id: 1, firstName: 'Ada', lastName: 'Lovelace' }

const fillIn = async (user, email = 'ada@example.com', password = 'correct horse') => {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('LoginPage', () => {
  it('logs in and goes to the recipe list', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithAuth(<LoginPage />, { route: '/login', login: vi.fn().mockResolvedValue(ada) })

    await fillIn(user)

    expect(auth.login).toHaveBeenCalledWith('ada@example.com', 'correct horse')
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })

  it('goes back to the page the user was sent from', async () => {
    const user = userEvent.setup()
    renderWithAuth(<LoginPage />, {
      route: '/login',
      state: { from: { pathname: '/meal-plans/9', search: '?x=1' } },
      login: vi.fn().mockResolvedValue(ada),
    })

    await fillIn(user)

    expect(screen.getByTestId('location')).toHaveTextContent('/meal-plans/9')
  })

  it('shows the error when the login is refused, and lets the user try again', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue(new Error('Invalid email or password'))
    renderWithAuth(<LoginPage />, { route: '/login', login })

    await fillIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })

  it('says it is logging in while waiting', async () => {
    const user = userEvent.setup()
    renderWithAuth(<LoginPage />, { route: '/login', login: vi.fn(() => new Promise(() => {})) })

    await fillIn(user)

    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled()
  })

  it('links to creating an account', () => {
    renderWithAuth(<LoginPage />, { route: '/login' })

    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
  })

  it('sends someone already logged in straight on', () => {
    renderWithAuth(<LoginPage />, { route: '/login', user: ada })

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })
})

describe('destinationAfterLogin', () => {
  it.each([
    [undefined, '/'],
    [{ from: { pathname: '/recipe/3', search: '', hash: '#steps' } }, '/recipe/3#steps'],
    [{ from: { pathname: '/login' } }, '/'],
    [{ from: { pathname: '/register' } }, '/'],
  ])('state %j -> %s', (state, expected) => {
    expect(destinationAfterLogin({ state })).toBe(expected)
  })
})
