import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './authContext'
import './Auth.css'

/**
 * Layout route for the pages that need a login: sends visitors to /login (remembering where
 * they were going) and shows who is logged in, with "Log out", above the page.
 */
export default function RequireAuth() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return (
    <>
      <div className="account-bar">
        <span>Signed in as <strong>{user.firstName} {user.lastName}</strong></span>
        <Link to="/account" className="account-bar-link">My account</Link>
        <button type="button" className="account-bar-logout" onClick={logout}>Log out</button>
      </div>
      <Outlet />
    </>
  )
}
