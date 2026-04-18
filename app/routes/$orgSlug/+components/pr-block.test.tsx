/** @vitest-environment happy-dom */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
} from 'vitest'
import {
  PRHideByTitleFilterContext,
  PRPopover,
  PRPopoverContent,
  type PRPopoverData,
  type PRPopoverLoaderData,
} from './pr-block'

const fetcherBag: {
  state: 'idle' | 'loading' | 'submitting'
  data: PRPopoverLoaderData | undefined
  load: Mock<(href: string) => void>
} = {
  state: 'idle',
  data: undefined,
  load: vi.fn(),
}

const useParamsMock = vi.fn(() => ({ orgSlug: 'acme' }))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    useParams: () => useParamsMock(),
    useFetcher: () => ({
      get state() {
        return fetcherBag.state
      },
      get data() {
        return fetcherBag.data
      },
      load: fetcherBag.load,
      Form: () => null,
      submit: vi.fn(),
    }),
  }
})

const samplePr: PRPopoverData = {
  number: 1,
  repo: 'acme/widget',
  title: 'Fix it',
  url: 'https://github.com/acme/widget/pull/1',
  createdAt: '2026-03-10T00:00:00Z',
  complexity: 'M',
  author: 'alice',
  authorDisplayName: 'Alice',
  reviewStatus: 'changes-pending',
  reviewerStates: [
    {
      login: 'alice',
      displayName: 'Alice',
      state: 'CHANGES_REQUESTED',
      submittedAt: '2026-03-11T00:00:00Z',
    },
  ],
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  fetcherBag.state = 'idle'
  fetcherBag.data = undefined
  useParamsMock.mockReturnValue({ orgSlug: 'acme' })
})

describe('PRPopover', () => {
  beforeEach(() => {
    fetcherBag.load.mockImplementation(() => {})
  })

  test('(a) loading skeleton when data undefined and loading', async () => {
    fetcherBag.state = 'loading'
    fetcherBag.data = undefined
    const user = userEvent.setup()
    render(
      <PRPopover prKey={{ repositoryId: 'repo-1', number: 1 }}>
        <button type="button">open</button>
      </PRPopover>,
    )
    await user.click(screen.getByRole('button', { name: 'open' }))
    const panel = screen.getByRole('dialog')
    expect(panel.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
  })

  test('(b) not_found message', async () => {
    fetcherBag.state = 'idle'
    fetcherBag.data = { pr: null, error: 'not_found' }
    const user = userEvent.setup()
    render(
      <PRPopover prKey={{ repositoryId: 'repo-1', number: 1 }}>
        <button type="button">open</button>
      </PRPopover>,
    )
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByText('PR が見つかりませんでした')).toBeTruthy()
  })

  test('(c) fetch_failed message and fallback link', async () => {
    fetcherBag.state = 'idle'
    fetcherBag.data = { pr: null, error: 'fetch_failed' }
    const user = userEvent.setup()
    render(
      <PRPopover
        prKey={{ repositoryId: 'repo-1', number: 1 }}
        fallback={{
          title: 'My title',
          url: 'https://github.com/acme/widget/pull/1',
          repo: 'acme/widget',
        }}
      >
        <button type="button">open</button>
      </PRPopover>,
    )
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByText('PR の情報を取得できませんでした')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'acme/widget#1' })
    expect(link.getAttribute('href')).toBe(
      'https://github.com/acme/widget/pull/1',
    )
  })

  test('(d) PR status badge inline + this-day review + reviewer states sections', () => {
    const pr: PRPopoverData = {
      ...samplePr,
      reviewStatus: 'approved-awaiting-merge',
      reviewerStates: [
        {
          login: 'bob',
          displayName: 'Bob',
          state: 'COMMENTED',
          submittedAt: '2026-03-11T00:00:00Z',
        },
      ],
    }
    render(<PRPopoverContent pr={pr} reviewState="APPROVED" />)
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
    expect(screen.getByText('この日の review')).toBeTruthy()
    expect(screen.getByText('Reviewers')).toBeTruthy()
  })

  test('(e) APPROVED reviewState coexists with CHANGES_REQUESTED reviewer row', () => {
    const pr: PRPopoverData = {
      ...samplePr,
      reviewStatus: 'approved-awaiting-merge',
      reviewerStates: [
        {
          login: 'viewer',
          displayName: 'Viewer',
          state: 'CHANGES_REQUESTED',
          submittedAt: '2026-03-12T00:00:00Z',
        },
      ],
    }
    render(<PRPopoverContent pr={pr} reviewState="APPROVED" />)
    const daySection = screen
      .getByText('この日の review')
      .closest('div')?.parentElement
    expect(daySection).not.toBeNull()
    expect(within(daySection as HTMLElement).getByText(/Approved/)).toBeTruthy()

    const reviewerSection = screen.getByText('Reviewers').parentElement
    expect(reviewerSection).not.toBeNull()
    expect(
      within(reviewerSection as HTMLElement).getByText(/Changes/),
    ).toBeTruthy()
  })

  test('(19) load URL uses orgSlug from useParams when switching org', async () => {
    useParamsMock.mockReturnValueOnce({ orgSlug: 'org-a' })
    const user = userEvent.setup()
    const { unmount } = render(
      <PRPopover prKey={{ repositoryId: 'repo-1', number: 2 }}>
        <button type="button">open-a</button>
      </PRPopover>,
    )
    await user.click(screen.getByRole('button', { name: 'open-a' }))
    expect(fetcherBag.load).toHaveBeenCalledWith(
      '/org-a/resources/pr-popover/repo-1/2',
    )
    unmount()

    useParamsMock.mockReturnValue({ orgSlug: 'org-b' })
    render(
      <PRPopover prKey={{ repositoryId: 'repo-1', number: 2 }}>
        <button type="button">open-b</button>
      </PRPopover>,
    )
    await user.click(screen.getByRole('button', { name: 'open-b' }))
    expect(fetcherBag.load).toHaveBeenCalledWith(
      '/org-b/resources/pr-popover/repo-1/2',
    )
  })

  test('(23) fetch_failed shows Hide PRs menu when admin context and fallback title', async () => {
    fetcherBag.data = { pr: null, error: 'fetch_failed' }
    const user = userEvent.setup()
    const hide = vi.fn()
    render(
      <PRHideByTitleFilterContext.Provider value={hide}>
        <PRPopover
          prKey={{ repositoryId: 'r', number: 3 }}
          fallback={{ title: 'Secret', url: 'https://x/y', repo: 'o/r' }}
        >
          <button type="button">open</button>
        </PRPopover>
      </PRHideByTitleFilterContext.Provider>,
    )
    await user.click(screen.getByRole('button', { name: 'open' }))
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByText('Hide PRs by title…'))
    expect(hide).toHaveBeenCalledWith('Secret')
  })
})
