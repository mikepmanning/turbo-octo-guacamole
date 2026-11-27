import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './authContext'
import {
  destinationAfterLogin, validateAccount, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH,
} from './accountRules'
import { toDateString } from '../components/mealPlan'
import FormField from './FormField'
import PageTitle from '../components/PageTitle'
import './Auth.css'

const EMPTY = { firstName: '', lastName: '', email: '', dateOfBirth: '', password: '', confirmPassword: '' }

export default function RegisterPage() {
  const { user, register } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [account, setAccount] = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const today = toDateString(new Date())

  if (user && !submitting) {
    return <Navigate to={destinationAfterLogin(location)} replace />
  }

  const update = (field) => (event) => {
    setAccount(current => ({ ...current, [field]: event.target.value }))
    setFieldErrors(current => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    const problems = validateAccount(account, today)
    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) return

    setSubmitting(true)
    try {
      const { confirmPassword: _ignored, ...details } = account
      await register({
        ...details,
        firstName: details.firstName.trim(),
        lastName: details.lastName.trim(),
        email: details.email.trim(),
      })
      navigate(destinationAfterLogin(location), { replace: true })
    } catch (err) {
      setFieldErrors(err.fieldErrors ?? {})
      setError(err.fieldErrors ? 'Please fix the highlighted fields.' : err.message)
      setSubmitting(false)
    }
  }

  const field = (name, label, props) => (
    <FormField
      name={name}
      label={label}
      value={account[name]}
      onChange={update(name)}
      error={fieldErrors[name]}
      {...props}
    />
  )

  return (
    <div className="auth-page">
      <div className="auth-card">
        <PageTitle title="Create account" />
        <h1>RecipeHome</h1>
        <h2>Create your account</h2>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="auth-row">
            {field('firstName', 'First name', { autoComplete: 'given-name', autoFocus: true })}
            {field('lastName', 'Last name', { autoComplete: 'family-name' })}
          </div>
          {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
          {field('dateOfBirth', 'Date of birth', { type: 'date', autoComplete: 'bday', max: today })}
          {field('password', 'Password', {
            type: 'password', autoComplete: 'new-password', maxLength: MAX_PASSWORD_LENGTH,
          })}
          {!fieldErrors.password && (
            <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters</span>
          )}
          {field('confirmPassword', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login" state={location.state}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
