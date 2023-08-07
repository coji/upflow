import { Spacer } from '@chakra-ui/react'
import { json, type LoaderArgs } from '@remix-run/node'
import { Link, Outlet, useLoaderData } from '@remix-run/react'
import { AppProfileMenuButton } from '~/app/components'
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Heading,
  HStack,
} from '~/app/components/ui'
import { getAdminUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderArgs) => {
  const adminUser = await getAdminUser(request)
  return json({ adminUser })
}

const AdminIndex = () => {
  const { adminUser } = useLoaderData<typeof loader>()

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto]">
      <div className="flex items-center px-4 py-1">
        <Heading>
          <Link to="/admin">UpFlow</Link>
        </Heading>

        <Badge className="ml-2">Admin</Badge>

        <Spacer />

        <DropdownMenu>
          <AppProfileMenuButton name={adminUser.displayName} pictureUrl={adminUser.pictureUrl ?? undefined} />
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <HStack>
                <div>
                  <p className="text-sm">{adminUser.displayName}</p>
                  <p className="text-xs text-gray-500">{adminUser.email}</p>
                </div>
                <Spacer />
                <Badge>{adminUser.role}</Badge>
              </HStack>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/">ユーザー画面</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/logout">ログアウト</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <main className="container bg-gray-200 py-2">
        <Outlet />
      </main>

      <footer className="p-4 text-center shadow">Copyright&copy; TechTalk Inc.</footer>
    </div>
  )
}
export default AdminIndex
