import { describe, expect, test } from 'vitest'
import { isOrgAdmin, isOrgOwner } from './member-role'

describe('member-role', () => {
  test('isOrgOwner is true only for owner', () => {
    expect(isOrgOwner('owner')).toBe(true)
    expect(isOrgOwner('admin')).toBe(false)
    expect(isOrgOwner('member')).toBe(false)
  })

  test('isOrgAdmin includes owner and admin', () => {
    expect(isOrgAdmin('owner')).toBe(true)
    expect(isOrgAdmin('admin')).toBe(true)
    expect(isOrgAdmin('member')).toBe(false)
  })
})
