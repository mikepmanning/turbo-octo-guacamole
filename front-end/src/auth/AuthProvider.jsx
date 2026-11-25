import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext'
import {
  authApi, getSession, saveSession, clearSession, SESSION_EXPIRED_EVENT,
} from '../services/api'

/**
 * Who is logged in. Starts from the session saved in localStorage (so a refresh stays logged
 * in), checks it with the server once, and logs out when the server stops accepting the token.
 */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession()?.user ?? null)

  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  // Refresh the saved user (a 401 here logs out through SESSION_EXPIRED_EVENT; other errors,
  // like the server being down, keep the session).
  useEffect(() => {
    if (!getSession()) return
    let cancelled = false
    authApi.getCurrentUser()
      .then(current => {
        const session = getSession()
        if (cancelled || !session) return
        saveSession({ ...session, user: current })
        setUser(current)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const startSession = useCallback((session) => {
    saveSession(session)
    setUser(session.user)
    return session.user
  }, [])

  const login = useCallback(
    async (email, password) => startSession(await authApi.login(email, password)),
    [startSession]
  )

  const register = useCallback(
    async (account) => startSession(await authApi.register(account)),
    [startSession]
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
