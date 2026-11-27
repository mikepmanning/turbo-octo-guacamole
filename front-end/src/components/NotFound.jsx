import { Link } from 'react-router-dom'
import PageTitle from './PageTitle'
import './ErrorBoundary.css'

/** Any address the app doesn't have a page for. */
function NotFound() {
  return (
    <div className="page-error">
      <PageTitle title="Page not found" />
      <h1>Page not found</h1>
      <p>There is no page at this address. It may have been mistyped, or the link may be out of date.</p>
      <div className="page-error-actions">
        <Link to="/">Back to Recipes</Link>
      </div>
    </div>
  )
}

export default NotFound
