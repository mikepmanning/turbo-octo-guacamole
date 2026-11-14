import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

// Shows the current path (and router state, as JSON in data-state) so tests
// can assert where the page navigated to and what it passed along.
function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="location" data-state={JSON.stringify(location.state ?? null)}>
      {location.pathname}
    </div>
  )
}

/**
 * Renders `element` as the page for `path`, starting at `route`.
 * `state` is passed as router state (e.g. { importedRecipe } for RecipeForm).
 */
export function renderWithRouter(element, { path = '/', route = '/', state } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: route, state }]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  )
}
