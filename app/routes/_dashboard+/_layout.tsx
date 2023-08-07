import {} from '@radix-ui/react-dropdown-menu'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, Outlet, useLoaderData } from '@remix-run/react'
import { AppLink, AppProfileMenuButton } from '~/app/components'
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  HStack,
  Heading,
  Spacer,
  Stack,
} from '~/app/components/ui'
import { getUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderArgs) => {
  const user = await getUser(request)
  return json({ user })
}

export default function IndexPage() {
  const { user } = useLoaderData<typeof loader>()

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto]">
      <div className="flex items-center px-4 py-1">
        <Heading>
          <AppLink to="/" color="gray.600">
            UpFlow
          </AppLink>
        </Heading>
        <Spacer />

        <Stack direction="row">
          <DropdownMenu>
            <AppProfileMenuButton name={user.displayName} pictureUrl={user.pictureUrl ?? undefined} />
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <HStack>
                  <div>
                    <p className="text-sm">{user.displayName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Spacer />
                  <Badge>{user.role}</Badge>
                </HStack>
              </DropdownMenuLabel>
              {user.role === 'admin' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin">Admin</Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/logout">ログアウト</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Stack>
      </div>

      <main className="container bg-gray-200 py-2">
        <Outlet />
      </main>

      <footer className="p-4 text-center shadow">Copyright&copy; TechTalk Inc.</footer>
    </div>
  )
}
