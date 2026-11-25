import { toDateString } from '../components/mealPlan'

export const MIN_PASSWORD_LENGTH = 8
// BCrypt (on the server) only uses the first 72 bytes, so the server refuses longer passwords.
export const MAX_PASSWORD_LENGTH = 72

// Where to go after logging in or creating an account: the page the user was sent to the
// login page from (RequireAuth puts it in the router state), else the recipe list.
export const destinationAfterLogin = (location) => {
  const from = location.state?.from
  return from?.pathname && from.pathname !== '/login' && from.pathname !== '/register'
    ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
    : '/'
}

// The sign-up checks made before asking the server (it checks again): { field: message } for
// each problem, empty when the account is fine. `today` is 'YYYY-MM-DD'.
export const validateAccount = (account, today = toDateString(new Date())) => {
  const errors = {}
  if (!account.firstName.trim()) errors.firstName = 'First name is required'
  if (!account.lastName.trim()) errors.lastName = 'Last name is required'
  if (!account.email.trim()) errors.email = 'Email is required'
  if (!account.dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
  // 'YYYY-MM-DD' strings compare in date order.
  else if (account.dateOfBirth >= today) errors.dateOfBirth = 'Date of birth must be in the past'
  if (account.password.length < MIN_PASSWORD_LENGTH || account.password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`
  }
  if (account.confirmPassword !== account.password) errors.confirmPassword = 'Passwords do not match'
  return errors
}
