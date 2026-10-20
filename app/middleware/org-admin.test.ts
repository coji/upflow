import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import type { MemberRole } from '~/app/libs/member-role'
import { orgAdminMiddleware } from './org-admin'

type MiddlewareArgs = Parameters<typeof orgAdminMiddleware>[0]

function argsFor(role: MemberRole) {
  return {
    request: new Request('http://localhost/acme/settings.data'),
    params: { orgSlug: 'acme' },
    context: { get: () => ({ membership: { id: 'm1', role } }) },
  } as unknown as MiddlewareArgs
}

describe('orgAdminMiddleware', () => {
  test('redirects members away before running the route', async () => {
    const next = vi.fn()

    let thrown: unknown
    try {
      await orgAdminMiddleware(argsFor('member'), next)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response).headers.get('Location')).toBe('/acme')
    expect(next).not.toHaveBeenCalled()
  })

  test.each(['admin', 'owner'] as const)(
    'runs the route for %s',
    async (role) => {
      const next = vi.fn().mockResolvedValue(new Response('ok'))

      await orgAdminMiddleware(argsFor(role), next)
      expect(next).toHaveBeenCalledOnce()
    },
  )

  // Structural check: importing the layout module pulls in the whole UI tree,
  // which is slow enough to time out on CI.
  test('is attached to the settings layout so it guards every settings route', () => {
    const layoutSource = readFileSync(
      path.resolve(
        import.meta.dirname,
        '../routes/$orgSlug/settings/_layout.tsx',
      ),
      'utf-8',
    )
    expect(layoutSource).toMatch(
      /export const middleware = \[[^\]]*\borgAdminMiddleware\b[^\]]*\]/,
    )
  })
})
