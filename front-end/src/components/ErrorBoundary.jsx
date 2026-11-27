import { Component } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from './PageTitle'
import './ErrorBoundary.css'

// A lazy page whose file is gone (usually: the app was updated since this tab loaded it) fails with one of these.
const isLoadFailure = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
    .test(error?.message ?? '')

/**
 * Catches an error while drawing a page, so the rest of the app keeps working: says what happened, with
 * "Reload page" and a link to the recipes. When a page couldn't be downloaded it says the app may have been
 * updated. Give it a `key` that changes on navigation (RequireAuth uses the path) to try again on the next page.
 */
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page failed to render', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const loadFailure = isLoadFailure(error)
    return (
      <div className="page-error" role="alert">
        <PageTitle title="Something went wrong" />
        <h1>{loadFailure ? 'This page could not be loaded' : 'Something went wrong'}</h1>
        <p>
          {loadFailure
            ? 'RecipeHome may have been updated since you opened it, or the connection dropped. Reloading usually fixes it.'
            : 'This page ran into a problem. Reloading may fix it; your saved recipes and plans are not affected.'}
        </p>
        <div className="page-error-actions">
          <button type="button" className="page-error-reload" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <Link to="/">Back to Recipes</Link>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
