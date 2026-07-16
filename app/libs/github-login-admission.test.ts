import { describe, expect, test } from 'vitest'
import { canAdmitGithubLogin } from './github-login-admission'

const base = {
  activeCompanyUser: false,
  firstUser: false,
  existingMembership: false,
  existingSuperAdmin: false,
  pendingHandoff: false,
}

describe('canAdmitGithubLogin', () => {
  test('does not let a handoff bypass an existing member restriction', () => {
    expect(
      canAdmitGithubLogin({
        ...base,
        existingMembership: true,
        pendingHandoff: true,
      }),
    ).toBe(false)
  })

  test('admits a new external account only with its pending handoff', () => {
    expect(canAdmitGithubLogin({ ...base, pendingHandoff: true })).toBe(true)
    expect(canAdmitGithubLogin(base)).toBe(false)
  })

  test('preserves first-user bootstrap and active company users', () => {
    expect(canAdmitGithubLogin({ ...base, firstUser: true })).toBe(true)
    expect(canAdmitGithubLogin({ ...base, activeCompanyUser: true })).toBe(true)
  })
})
