import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './authContext'
import { authApi } from '../services/api'
import { validateProfile, validatePasswordChange, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from './accountRules'
import { toDateString } from '../components/mealPlan'
import FormField from './FormField'
import './Auth.css'

const profileOf = (user) => ({
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  email: user.email ?? '',
  dateOfBirth: user.dateOfBirth ?? '',
})

const NO_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' }

// One form's state: its values, field errors, form-level error, success notice and saving flag.
function useAccountForm(initial) {
  const [values, setValues] = useState(initial)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)

  const update = (field) => (event) => {
    setValues(current => ({ ...current, [field]: event.target.value }))
    setFieldErrors(current => ({ ...current, [field]: undefined }))
    setNotice(null)
  }

  // Checks with `validate`, then runs `save`; on success shows `success` and calls `after`.
  const submit = async (validate, save, success, after) => {
    setError(null)
    setNotice(null)
    const problems = validate(values)
    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) return
    setSaving(true)
    try {
      const result = await save(values)
      setNotice(success)
      after?.(result)
    } catch (err) {
      setFieldErrors(err.fieldErrors ?? {})
      setError(err.fieldErrors ? 'Please fix the highlighted fields.' : err.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (name, label, props) => (
    <FormField
      name={name}
      label={label}
      value={values[name]}
      onChange={update(name)}
      error={fieldErrors[name]}
      {...props}
    />
  )

  return { values, setValues, error, notice, saving, submit, field }
}

/** /account: edit your name, email and date of birth, and change your password. */
export default function AccountPage() {
  const { user, updateUser } = useAuth()
  const today = toDateString(new Date())
  const profile = useAccountForm(profileOf(user))
  const password = useAccountForm(NO_PASSWORDS)

  const saveProfile = (event) => {
    event.preventDefault()
    profile.submit(
      values => validateProfile(values, today),
      values => authApi.updateProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        dateOfBirth: values.dateOfBirth,
      }),
      'Your details were saved.',
      updated => {
        updateUser(updated)
        profile.setValues(profileOf(updated))
      }
    )
  }

  const changePassword = (event) => {
    event.preventDefault()
    password.submit(
      validatePasswordChange,
      values => authApi.changePassword(values.currentPassword, values.newPassword),
      'Your password was changed.',
      () => password.setValues(NO_PASSWORDS)
    )
  }

  return (
    <div className="account-page">
      <Link to="/" className="account-back">← Back to recipes</Link>
      <h1>My Account</h1>

      <section className="auth-card account-section" aria-labelledby="details-heading">
        <h2 id="details-heading">Your details</h2>
        <form onSubmit={saveProfile} className="auth-form" noValidate>
          {profile.error && <p className="auth-error" role="alert">{profile.error}</p>}
          {profile.notice && <p className="auth-notice" role="status">{profile.notice}</p>}
          <div className="auth-row">
            {profile.field('firstName', 'First name', { autoComplete: 'given-name' })}
            {profile.field('lastName', 'Last name', { autoComplete: 'family-name' })}
          </div>
          {profile.field('email', 'Email', { type: 'email', autoComplete: 'email' })}
          {profile.field('dateOfBirth', 'Date of birth', { type: 'date', autoComplete: 'bday', max: today })}
          <button type="submit" className="auth-submit" disabled={profile.saving}>
            {profile.saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="auth-card account-section" aria-labelledby="password-heading">
        <h2 id="password-heading">Change password</h2>
        <form onSubmit={changePassword} className="auth-form" noValidate>
          {password.error && <p className="auth-error" role="alert">{password.error}</p>}
          {password.notice && <p className="auth-notice" role="status">{password.notice}</p>}
          {password.field('currentPassword', 'Current password', {
            type: 'password', autoComplete: 'current-password',
          })}
          {password.field('newPassword', 'New password', {
            type: 'password', autoComplete: 'new-password', maxLength: MAX_PASSWORD_LENGTH,
          })}
          <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters</span>
          {password.field('confirmPassword', 'Confirm new password', {
            type: 'password', autoComplete: 'new-password',
          })}
          <button type="submit" className="auth-submit" disabled={password.saving}>
            {password.saving ? 'Changing...' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  )
}
