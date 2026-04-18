/** @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TeamStacksData } from '../+functions/aggregate-stacks'
import { TeamStacksChart } from './team-stacks-chart'

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    useFetcher: () => ({
      state: 'idle' as const,
      data: undefined,
      load: vi.fn(),
      Form: () => null,
      submit: vi.fn(),
    }),
  }
})

function makeData(): TeamStacksData {
  const pr = {
    number: 1,
    repositoryId: 'repo-1',
    repo: 'acme/widget',
    title: 'Example',
    url: 'https://github.com/acme/widget/pull/1',
    author: 'alice',
    createdAt: '2026-03-01T00:00:00Z',
    complexity: 'S' as string | null,
    reviewStatus: 'in-review' as const,
  }
  return {
    authorStacks: [{ login: 'alice', displayName: 'Alice', prs: [{ ...pr }] }],
    reviewerStacks: [{ login: 'bob', displayName: 'Bob', prs: [{ ...pr }] }],
    unassignedPRs: [],
    approvedAwaitingMergePRs: [],
    changesPendingPRs: [],
    personalLimit: 2,
  }
}

function renderChart(data: TeamStacksData) {
  return render(
    <MemoryRouter initialEntries={['/acme/workload']}>
      <Routes>
        <Route
          path="/:orgSlug/workload"
          element={<TeamStacksChart data={data} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
})

describe('TeamStacksChart', () => {
  test('hover highlights both columns for the same PR via author / prKey', async () => {
    const user = userEvent.setup()
    renderChart(makeData())
    const buttons = screen.getAllByRole('button', {
      name: /acme\/widget#1/,
    })
    expect(buttons).toHaveLength(2)
    const authoredRow = buttons[0].closest('.flex.items-center.gap-3')
    const reviewRow = buttons[1].closest('.flex.items-center.gap-3')
    expect(authoredRow).toBeTruthy()
    expect(reviewRow).toBeTruthy()
    expect(authoredRow?.className.includes('bg-accent')).toBe(false)
    await user.hover(buttons[0])
    expect(authoredRow?.className.includes('bg-accent')).toBe(true)
    expect(reviewRow?.className.includes('bg-accent')).toBe(true)
    await user.unhover(buttons[0])
    expect(authoredRow?.className.includes('bg-accent')).toBe(false)
  })

  test('selecting PR in authored column scrolls the review column container', async () => {
    const user = userEvent.setup()
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0)
        return 0
      })
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('overflow-y-auto')) {
          return new DOMRect(0, 0, 100, 100)
        }
        if (this.querySelector('[aria-label="acme/widget#1 (In review)"]')) {
          return new DOMRect(0, 150, 100, 40)
        }
        return new DOMRect(0, 0, 0, 0)
      })

    renderChart(makeData())
    const buttons = screen.getAllByRole('button', {
      name: /acme\/widget#1/,
    })
    const reviewSection = screen.getByText(
      'Review Queue (pending)',
    ).parentElement
    const scrollContainer = reviewSection?.querySelector(
      '.overflow-y-auto',
    ) as HTMLElement
    expect(scrollContainer).toBeTruthy()
    const scrollBySpy = vi
      .spyOn(scrollContainer, 'scrollBy')
      .mockImplementation(() => {})

    await user.click(buttons[0])
    expect(scrollBySpy).toHaveBeenCalled()
    scrollBySpy.mockRestore()
    rectSpy.mockRestore()
    rafSpy.mockRestore()
  })
})
