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
  test('card classes are identical regardless of error', () => {
    const { container: noError } = render(<LoginPage {...loginProps(null)} />)
    const noErrorCard = noError.querySelector('[data-slot="card"]')?.className
    cleanup()
    const { container: withError } = render(
      <LoginPage {...loginProps('unable_to_get_user_info')} />,
    )
    const withErrorCard =
      withError.querySelector('[data-slot="card"]')?.className
    expect(noErrorCard).toBe(withErrorCard)
    expect(noErrorCard).toContain('max-w-sm')
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
  })
})
