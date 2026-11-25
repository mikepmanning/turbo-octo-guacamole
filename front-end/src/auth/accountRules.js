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

// The checks below are made before asking the server (it checks again). Each returns
// { field: message } for each problem, empty when everything is fine. `today` is 'YYYY-MM-DD'.

const passwordLengthError = (password) =>
  password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH
    ? `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`
    : null

// Names, email and date of birth: signing up and editing your details.
export const validateProfile = (profile, today = toDateString(new Date())) => {
  const errors = {}
  if (!profile.firstName.trim()) errors.firstName = 'First name is required'
  if (!profile.lastName.trim()) errors.lastName = 'Last name is required'
  if (!profile.email.trim()) errors.email = 'Email is required'
  if (!profile.dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
  // 'YYYY-MM-DD' strings compare in date order.
  else if (profile.dateOfBirth >= today) errors.dateOfBirth = 'Date of birth must be in the past'
  return errors
}

// Signing up: the profile plus a password typed twice.
export const validateAccount = (account, today = toDateString(new Date())) => {
  const errors = validateProfile(account, today)
  const length = passwordLengthError(account.password)
  if (length) errors.password = length
  if (account.confirmPassword !== account.password) errors.confirmPassword = 'Passwords do not match'
  return errors
}

// Changing the password: { currentPassword, newPassword, confirmPassword }.
export const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
  const errors = {}
  if (!currentPassword) errors.currentPassword = 'Current password is required'
  const length = passwordLengthError(newPassword)
  if (length) errors.newPassword = length
  else if (newPassword === currentPassword) errors.newPassword = 'Choose a password different from your current one'
  if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match'
  return errors
}
