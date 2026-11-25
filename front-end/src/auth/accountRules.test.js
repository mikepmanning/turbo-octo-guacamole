import { describe, it, expect } from 'vitest'
import { validateProfile, validatePasswordChange } from './accountRules'

describe('validateProfile', () => {
  const valid = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', dateOfBirth: '1990-12-10' }

  it('accepts complete details, with no password involved', () => {
    expect(validateProfile(valid, '2026-11-24')).toEqual({})
  })

  it('needs every field and a date of birth before today', () => {
    expect(validateProfile({ ...valid, email: ' ', dateOfBirth: '2026-11-25' }, '2026-11-24')).toEqual({
      email: 'Email is required',
      dateOfBirth: 'Date of birth must be in the past',
    })
  })
})

describe('validatePasswordChange', () => {
  it('accepts a new password typed twice', () => {
    expect(validatePasswordChange({
      currentPassword: 'correct horse', newPassword: 'a new password', confirmPassword: 'a new password',
    })).toEqual({})
  })

  it('needs the current password, a long enough new one, typed the same twice', () => {
    expect(validatePasswordChange({ currentPassword: '', newPassword: 'short', confirmPassword: 'shorts' })).toEqual({
      currentPassword: 'Current password is required',
      newPassword: 'Password must be 8 to 72 characters',
      confirmPassword: 'Passwords do not match',
    })
  })

  it('refuses the same password again', () => {
    expect(validatePasswordChange({
      currentPassword: 'correct horse', newPassword: 'correct horse', confirmPassword: 'correct horse',
    }).newPassword).toBe('Choose a password different from your current one')
  })
})
