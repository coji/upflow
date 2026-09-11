/** @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { DraftFilterStatus } from './draft-filter-status'

function renderStatus(
  props: { draftCount: number; hideDrafts: boolean },
  initialEntry = '/acme/workload',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/:orgSlug/workload"
          element={<DraftFilterStatus {...props} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
})

describe('DraftFilterStatus', () => {
  test('renders nothing when there are no drafts', () => {
    const { container } = renderStatus({ draftCount: 0, hideDrafts: false })
    expect(container).toBeEmptyDOMElement()
  })

  test('shows hide action linking to ?hideDrafts=1', () => {
    renderStatus({ draftCount: 3, hideDrafts: false })
    const link = screen.getByRole('link', { name: 'Hide 3 drafts' })
    expect(link.getAttribute('href')).toBe('/acme/workload?hideDrafts=1')
  })

  test('singular label for one draft', () => {
    renderStatus({ draftCount: 1, hideDrafts: false })
    expect(screen.getByRole('link', { name: 'Hide 1 draft' })).toBeTruthy()
  })

  test('hidden state links back to show-all', () => {
    renderStatus(
      { draftCount: 2, hideDrafts: true },
      '/acme/workload?hideDrafts=1',
    )
    const link = screen.getByRole('link', {
      name: 'Show all drafts (2 drafts hidden)',
    })
    expect(link.getAttribute('href')).toBe('/acme/workload')
  })
})
