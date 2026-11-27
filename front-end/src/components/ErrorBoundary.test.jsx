import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'

function Broken({ error }) {
  throw error
}

const renderBoundary = (child, key = 'a') =>
  render(
    <MemoryRouter>
      <ErrorBoundary key={key}>{child}</ErrorBoundary>
    </MemoryRouter>
  )

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React and the boundary both log the caught error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows its children when nothing goes wrong', () => {
    renderBoundary(<p>All good</p>)

    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows an error page with Reload and a way back when a page throws', () => {
    renderBoundary(<Broken error={new Error('boom')} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Recipes' })).toHaveAttribute('href', '/')
    expect(console.error).toHaveBeenCalledWith('Page failed to render', expect.any(Error), expect.anything())
  })

  it('says the app may have been updated when a page could not be downloaded', () => {
    renderBoundary(<Broken error={new TypeError('Failed to fetch dynamically imported module: /assets/x.js')} />)

    expect(screen.getByRole('heading', { name: 'This page could not be loaded' })).toBeInTheDocument()
    expect(screen.getByText(/may have been updated/)).toBeInTheDocument()
  })

  it('starts over when its key changes (the next page)', () => {
    const { rerender } = renderBoundary(<Broken error={new Error('boom')} />)

    rerender(
      <MemoryRouter>
        <ErrorBoundary key="b"><p>Next page</p></ErrorBoundary>
      </MemoryRouter>
    )

    expect(screen.getByText('Next page')).toBeInTheDocument()
  })
})
