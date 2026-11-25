import { createContext, useContext } from 'react'

// { user, login(email, password), register(account), logout() }; see AuthProvider.
export const AuthContext = createContext(null)

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
