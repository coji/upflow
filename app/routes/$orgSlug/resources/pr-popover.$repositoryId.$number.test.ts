import { beforeEach, describe, expect, test, vi } from 'vitest'
import { captureExceptionToSentry } from '~/app/libs/sentry-node.server'
import { orgContext } from '~/app/middleware/context'
import { getPullRequestForPopover } from '~/app/services/pr-popover-queries.server'
import { toOrgId } from '~/app/types/organization'
import type { Route } from './+types/pr-popover.$repositoryId.$number'
import { loader } from './pr-popover.$repositoryId.$number'

vi.mock('~/app/services/pr-popover-queries.server', () => ({
  getPullRequestForPopover: vi.fn(),
}))

vi.mock('~/app/libs/sentry-node.server', () => ({
  captureExceptionToSentry: vi.fn(),
}))

const mockGetPr = vi.mocked(getPullRequestForPopover)
const mockSentry = vi.mocked(captureExceptionToSentry)

const organizationId = toOrgId('test-org-loader')

function loaderContext(): Route.LoaderArgs['context'] {
  return {
    get: (ctx) => {
      if (ctx === orgContext) {
        return {
          user: {
            id: 'user-1',
            name: 'Test',
            email: 't@example.com',
            emailVerified: true,
            image: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          organization: {
            id: organizationId,
            name: 'Acme',
            slug: 'acme',
          },
          membership: { id: 'mem-1', role: 'member' },
        }
      }
      throw new Error('unexpected context')
    },
  } as Route.LoaderArgs['context']
}

function callLoader(params: {
  orgSlug: string
  repositoryId: string
  number: string
}) {
  return loader({
    params,
    context: loaderContext(),
    request: new Request(
      `http://localhost/${params.orgSlug}/resources/pr-popover/${params.repositoryId}/${params.number}`,
    ),
  } as Route.LoaderArgs)
}

function unwrapLoaderResult(result: unknown): {
  status: number
  headers: Headers
  data: unknown
} {
  expect(result).toEqual(
    expect.objectContaining({ type: 'DataWithResponseInit' }),
  )
  const r = result as {
    type: 'DataWithResponseInit'
    data: unknown
    init: { status?: number; headers?: HeadersInit } | null
  }
  const status = r.init?.status ?? 200
  const headers = new Headers(r.init?.headers ?? undefined)
  return { status, headers, data: r.data }
}

const samplePr = {
  number: 1,
  repo: 'acme/widget',
  title: 'Fix bug',
  url: 'https://github.com/acme/widget/pull/1',
  createdAt: '2026-03-10T00:00:00Z',
  complexity: 'M' as string | null,
  author: 'alice',
  authorDisplayName: 'Alice',
  reviewStatus: 'approved-awaiting-merge' as const,
  reviewerStates: [],
}

describe('pr-popover resource loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('success: 200, pr body, private max-age=30', async () => {
    mockGetPr.mockResolvedValue(samplePr)
    const {
      status,
      headers,
      data: body,
    } = unwrapLoaderResult(
      await callLoader({
        orgSlug: 'acme',
        repositoryId: 'repo-1',
        number: '1',
      }),
    )
    expect(status).toBe(200)
    expect(headers.get('Cache-Control')).toBe('private, max-age=30')
    expect(body).toEqual({ pr: samplePr })
    expect(mockGetPr).toHaveBeenCalledWith(organizationId, 'repo-1', 1)
  })

  test('not_found when PR missing: 200, no-store, error not_found', async () => {
    mockGetPr.mockResolvedValue(null)
    const {
      status,
      headers,
      data: body,
    } = unwrapLoaderResult(
      await callLoader({
        orgSlug: 'acme',
        repositoryId: 'repo-1',
        number: '2',
      }),
    )
    expect(status).toBe(200)
    expect(headers.get('Cache-Control')).toBe('no-store')
    expect(body).toEqual({ pr: null, error: 'not_found' })
  })

  test('not_found when number is NaN: 200, no-store', async () => {
    const {
      status,
      headers,
      data: body,
    } = unwrapLoaderResult(
      await callLoader({
        orgSlug: 'acme',
        repositoryId: 'repo-1',
        number: 'x',
      }),
    )
    expect(status).toBe(200)
    expect(headers.get('Cache-Control')).toBe('no-store')
    expect(body).toEqual({ pr: null, error: 'not_found' })
    expect(mockGetPr).not.toHaveBeenCalled()
  })

  test('not_found when repositoryId empty', async () => {
    const { status, data: body } = unwrapLoaderResult(
      await callLoader({
        orgSlug: 'acme',
        repositoryId: '   ',
        number: '1',
      }),
    )
    expect(status).toBe(200)
    expect(body).toEqual({ pr: null, error: 'not_found' })
    expect(mockGetPr).not.toHaveBeenCalled()
  })

  test('fetch_failed: 500, no-store, Sentry extra, no throw', async () => {
    const err = new Error('db down')
    mockGetPr.mockRejectedValue(err)
    const {
      status,
      headers,
      data: body,
    } = unwrapLoaderResult(
      await callLoader({
        orgSlug: 'acme',
        repositoryId: 'repo-1',
        number: '1',
      }),
    )
    expect(status).toBe(500)
    expect(headers.get('Cache-Control')).toBe('no-store')
    expect(body).toEqual({ pr: null, error: 'fetch_failed' })
    expect(mockSentry).toHaveBeenCalledWith(err, {
      extra: {
        organizationId,
        repositoryId: 'repo-1',
        number: 1,
      },
    })
  })

  test('tenant scope uses organization.id from context', async () => {
    mockGetPr.mockResolvedValue(null)
    await callLoader({
      orgSlug: 'acme',
      repositoryId: 'other-tenant-repo',
      number: '1',
    })
    expect(mockGetPr).toHaveBeenCalledWith(
      organizationId,
      'other-tenant-repo',
      1,
    )
  })
})
