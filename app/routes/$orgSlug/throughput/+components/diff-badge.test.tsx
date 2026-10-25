/** @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { DiffBadge } from './diff-badge'

afterEach(cleanup)

describe('DiffBadge', () => {
  test('renders nothing when the change rounds to zero', () => {
    const { container } = render(<DiffBadge value={0.92} prevValue={0.9} />)
    expect(container.textContent).toBe('')
  })

  test('shows a rounded positive change', () => {
    const { container } = render(<DiffBadge value={1.26} prevValue={1} />)
    expect(container.textContent).toBe('+0.3')
  })

  test('colors a decrease as better when inverted', () => {
    const { container } = render(
      <DiffBadge value={1} prevValue={2} invertColor />,
    )
    expect(container.querySelector('span')?.className).toContain('emerald')
  })
})
