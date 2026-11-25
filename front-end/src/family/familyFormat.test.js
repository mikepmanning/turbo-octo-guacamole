import { describe, it, expect } from 'vitest'
import { formatInviteCode, fullName, ownerOf } from './familyFormat'
import { ownedFamily, memberFamily } from '../test/fixtures/families'

describe('formatInviteCode', () => {
  it.each([
    ['ABCD2345', 'ABCD-2345'],
    ['ABC', 'ABC'],
    [null, ''],
    [undefined, ''],
  ])('%s -> %s', (code, expected) => {
    expect(formatInviteCode(code)).toBe(expected)
  })
})

describe('fullName and ownerOf', () => {
  it('finds the owner by role', () => {
    expect(fullName(ownerOf(ownedFamily))).toBe('Ada Lovelace')
    expect(fullName(ownerOf(memberFamily))).toBe('Grace Hopper')
  })
})
