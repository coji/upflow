import { href, redirect, useFetcher } from 'react-router'
import { DropdownMenuItem } from '~/app/components/ui'
import { auth, requireUser } from '~/app/libs/auth.server'
import type { Route } from './+types/logout'

export const action = async ({ request }: Route.ActionArgs) => {
  await requireUser(request)
  await auth.api.signOut({
    headers: request.headers,
  })
  return redirect('/login')
}

export const DropdownMenuLogout = () => {
  const fetcher = useFetcher<typeof action>()

  return (
    <DropdownMenuItem
      onClick={() =>
        fetcher.submit(null, { method: 'POST', action: href('/logout') })
      }
    >
      ログアウト
    </DropdownMenuItem>
  )
}
