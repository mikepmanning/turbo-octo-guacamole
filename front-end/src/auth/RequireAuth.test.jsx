import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import RequireAuth from './RequireAuth'
import { AuthContext } from './authContext'

function LoginProbe() {
  const location = useLocation()
  return <p>Login page, from {location.state?.from?.pathname}</p>
}

const renderAt = (route, auth) => render(
  <AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route element={<RequireAuth />}>
          <Route path="/meal-plans" element={<p>Meal plans page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>
)

describe('RequireAuth', () => {
  it('sends a visitor to the login page, remembering where they were going', () => {
    renderAt('/meal-plans', { user: null, logout: vi.fn() })

    expect(screen.getByText('Login page, from /meal-plans')).toBeInTheDocument()
    expect(screen.queryByText('Meal plans page')).not.toBeInTheDocument()
  })

  it('shows the page and who is logged in, with Log out', async () => {
    const user = userEvent.setup()
    const logout = vi.fn()
    renderAt('/meal-plans', { user: { firstName: 'Ada', lastName: 'Lovelace' }, logout })

    expect(screen.getByText('Meal plans page')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalled()
  })
})
