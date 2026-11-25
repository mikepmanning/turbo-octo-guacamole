import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthProvider from './AuthProvider'
import { useAuth } from './authContext'
import { authApi, saveSession, getSession, clearSession, SESSION_EXPIRED_EVENT } from '../services/api'

// Session helpers stay real (localStorage); the server calls are mocked.
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  authApi: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn() },
}))

const ada = { id: 1, email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-12-10' }
const session = { token: 'tok', expiresAt: '2999-01-01T00:00:00Z', user: ada }

function Probe() {
  const { user, login, register, logout, updateUser } = useAuth()
  return (
    <div>
      <p>{user ? `User: ${user.firstName}` : 'Logged out'}</p>
      <button onClick={() => login('ada@example.com', 'pw').catch(() => {})}>login</button>
      <button onClick={() => register({ email: 'ada@example.com' })}>register</button>
      <button onClick={logout}>logout</button>
      <button onClick={() => updateUser({ ...ada, firstName: 'Augusta' })}>update</button>
    </div>
  )
}

const renderProvider = () => render(<AuthProvider><Probe /></AuthProvider>)

describe('AuthProvider', () => {
  beforeEach(() => {
    clearSession()
    authApi.getCurrentUser.mockResolvedValue(ada)
  })

  it('starts logged out without a saved session, and does not call the server', () => {
    renderProvider()

    expect(screen.getByText('Logged out')).toBeInTheDocument()
    expect(authApi.getCurrentUser).not.toHaveBeenCalled()
  })

  it('starts logged in from the saved session and refreshes the user from the server', async () => {
    saveSession(session)
    authApi.getCurrentUser.mockResolvedValue({ ...ada, firstName: 'Augusta' })
    renderProvider()

    expect(screen.getByText('User: Ada')).toBeInTheDocument()
    expect(await screen.findByText('User: Augusta')).toBeInTheDocument()
    expect(getSession().user.firstName).toBe('Augusta')
  })

  it('keeps the session when the server cannot be reached', async () => {
    saveSession(session)
    authApi.getCurrentUser.mockRejectedValue(new Error('Failed to load your account'))
    renderProvider()

    await waitFor(() => expect(authApi.getCurrentUser).toHaveBeenCalled())
    expect(screen.getByText('User: Ada')).toBeInTheDocument()
    expect(getSession()).not.toBeNull()
  })

  it('login saves the session', async () => {
    const user = userEvent.setup()
    authApi.login.mockResolvedValue(session)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'login' }))

    expect(await screen.findByText('User: Ada')).toBeInTheDocument()
    expect(getSession().token).toBe('tok')
  })

  it('a failed login leaves the user logged out', async () => {
    const user = userEvent.setup()
    authApi.login.mockRejectedValue(new Error('Invalid email or password'))
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'login' }))

    expect(screen.getByText('Logged out')).toBeInTheDocument()
    expect(getSession()).toBeNull()
  })

  it('register saves the session', async () => {
    const user = userEvent.setup()
    authApi.register.mockResolvedValue(session)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'register' }))

    expect(await screen.findByText('User: Ada')).toBeInTheDocument()
    expect(getSession().user).toEqual(ada)
  })

  it('logout forgets the session', async () => {
    const user = userEvent.setup()
    saveSession(session)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'logout' }))

    expect(screen.getByText('Logged out')).toBeInTheDocument()
    expect(getSession()).toBeNull()
  })

  it('logs out when the server rejects the token', async () => {
    saveSession(session)
    renderProvider()
    await screen.findByText('User: Ada')

    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)))

    expect(screen.getByText('Logged out')).toBeInTheDocument()
  })

  it('updateUser shows and saves the new details, keeping the token', async () => {
    const user = userEvent.setup()
    saveSession(session)
    renderProvider()
    await screen.findByText('User: Ada')

    await user.click(screen.getByRole('button', { name: 'update' }))

    expect(screen.getByText('User: Augusta')).toBeInTheDocument()
    expect(getSession()).toEqual({ ...session, user: { ...ada, firstName: 'Augusta' } })
  })

  it('useAuth outside the provider is a mistake', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside <AuthProvider>')
  })
})
