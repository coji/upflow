import type { Run } from '@coji/durably'
import { describe, expect, test, vi } from 'vitest'
import type { MemberRole } from '~/app/libs/member-role'
import { createDurablyAuth } from './durably-auth.server'

// Deps are injected below; avoid loading the real auth/db modules
vi.mock('~/app/libs/auth.server', () => ({
  getSession: vi.fn(),
  getUserOrganizations: vi.fn(),
}))

const orgs: Array<{
  id: string
  name: string
  slug: string
  role: MemberRole
}> = [
  { id: 'org-owner', name: 'A', slug: 'a', role: 'owner' },
  { id: 'org-admin', name: 'B', slug: 'b', role: 'admin' },
  { id: 'org-member', name: 'C', slug: 'c', role: 'member' },
]

const auth = createDurablyAuth({
  getSession: async () => ({ user: { id: 'user-1' } }),
  getUserOrganizations: async () => orgs as never,
})

const request = new Request('http://localhost/api/durably/runs')
const runIn = (organizationId: string) =>
  ({ labels: { organizationId } }) as unknown as Run<Record<string, string>>

const status = async (fn: () => unknown) => {
  try {
    await fn()
    return 'allowed'
  } catch (e) {
    if (e instanceof Response) return e.status
    throw e
  }
}

describe('createDurablyAuth', () => {
  test('rejects unauthenticated requests', async () => {
    const anon = createDurablyAuth({
      getSession: async () => null,
      getUserOrganizations: async () => [],
    })
    expect(await status(() => anon.authenticate(request))).toBe(401)
  })

  test('only owner/admin organizations are accessible', async () => {
    const ctx = await auth.authenticate(request)
    expect([...ctx.orgIds].sort()).toEqual(['org-admin', 'org-owner'])
  })

  test.each([
    'read',
    'subscribe',
    'steps',
    'retrigger',
    'cancel',
    'delete',
  ] as const)('member cannot %s runs of their org', async (operation) => {
    const ctx = await auth.authenticate(request)
    expect(
      await status(() =>
        auth.onRunAccess?.(ctx, runIn('org-member'), { operation }),
      ),
    ).toBe(403)
    expect(
      await status(() =>
        auth.onRunAccess?.(ctx, runIn('org-admin'), { operation }),
      ),
    ).toBe('allowed')
  })

  test('member cannot list runs of their org', async () => {
    const ctx = await auth.authenticate(request)
    expect(
      await status(() =>
        auth.scopeRuns?.(ctx, { labels: { organizationId: 'org-member' } }),
      ),
    ).toBe(403)
    expect(
      await status(() =>
        auth.scopeRuns?.(ctx, { labels: { organizationId: 'org-owner' } }),
      ),
    ).toBe('allowed')
  })

  test('HTTP trigger is always blocked', async () => {
    const ctx = await auth.authenticate(request)
    expect(
      await status(() =>
        auth.onTrigger?.(ctx, { jobName: 'crawl', input: {} } as never),
      ),
    ).toBe(403)
  })
})
