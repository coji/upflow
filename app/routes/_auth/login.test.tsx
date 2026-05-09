/** @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import LoginPage from './login'
import type { Route } from './+types/login'

vi.mock('~/app/libs/auth.server', () => ({}))

const unauthorizedCopy =
  'This GitHub account is not authorized to sign in. Please ask an administrator to enable access.'

function loginProps(error: string | null): Route.ComponentProps {
  return {
    loaderData: { error, redirectTo: '/' },
  } as Route.ComponentProps
}

afterEach(() => {
  cleanup()
})

describe('LoginPage', () => {
  test.each([
    { error: null, label: 'no error' },
    { error: 'unable_to_get_user_info', label: 'with error' },
  ])('card width is stable ($label)', ({ error }) => {
    const { container } = render(<LoginPage {...loginProps(error)} />)
    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass('w-full', 'max-w-sm')
  })

  test('error param renders alert with mapped copy', () => {
    render(<LoginPage {...loginProps('unable_to_get_user_info')} />)
    expect(screen.getByRole('alert')).toHaveTextContent(unauthorizedCopy)
  })

  test('unknown error key falls back to generic copy', () => {
    render(<LoginPage {...loginProps('some_other_key')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in failed.')
  })

  test('no error param renders no alert', () => {
    render(<LoginPage {...loginProps(null)} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Sign in failed.')).not.toBeInTheDocument()
    expect(screen.queryByText(unauthorizedCopy)).not.toBeInTheDocument()
  })
})
