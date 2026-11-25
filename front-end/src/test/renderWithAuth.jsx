import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext } from '../auth/authContext'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

/**
 * Renders `element` at `route` with a stand-in AuthContext: pass `user` (null = logged out) and
 * any of login/register/logout (vi.fn() by default). `routes` adds other pages, e.g. { '/': 'Home' }.
 * Returns the render result plus `auth`, the context value.
 */
export function renderWithAuth(element, { route = '/', path = route, state, user = null, routes = {}, ...overrides } = {}) {
  const auth = { user, login: vi.fn(), register: vi.fn(), logout: vi.fn(), updateUser: vi.fn(), ...overrides }
  const result = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[{ pathname: route, state }]}>
        <Routes>
          <Route path={path} element={element} />
          {Object.entries(routes).map(([to, text]) => (
            <Route key={to} path={to} element={<p>{text}</p>} />
          ))}
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </AuthContext.Provider>
  )
  return { ...result, auth }
}
