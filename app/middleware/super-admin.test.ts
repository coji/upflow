import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'

const requireSuperAdmin = vi.fn()
vi.mock('~/app/libs/auth.server', () => ({ requireSuperAdmin }))

const { superAdminMiddleware } = await import('./super-admin')

type MiddlewareArgs = Parameters<typeof superAdminMiddleware>[0]
const args = {
  request: new Request('http://localhost/admin.data'),
} as MiddlewareArgs

describe('superAdminMiddleware', () => {
  test('rejects before running the route when not a superadmin', async () => {
    const denied = new Response(null, { status: 302 })
    requireSuperAdmin.mockRejectedValueOnce(denied)
    const next = vi.fn()

    await expect(superAdminMiddleware(args, next)).rejects.toBe(denied)
    expect(next).not.toHaveBeenCalled()
  })

  test('runs the route for a superadmin', async () => {
    requireSuperAdmin.mockResolvedValueOnce({ user: { role: 'admin' } })
    const next = vi.fn().mockResolvedValue(new Response('ok'))

    await superAdminMiddleware(args, next)
    expect(next).toHaveBeenCalledOnce()
  })

  // Structural check: importing the layout module pulls in the whole UI tree,
  // which is slow enough to time out on CI.
  test('is attached to the /admin layout so it guards every child route', () => {
    const layoutSource = readFileSync(
      path.resolve(import.meta.dirname, '../routes/admin/_layout.tsx'),
      'utf-8',
    )
    expect(layoutSource).toMatch(
      /export const middleware = \[[^\]]*\bsuperAdminMiddleware\b[^\]]*\]/,
    )
  })
})
