import { Link, useLocation } from '@remix-run/react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  HStack,
  Heading,
  Spacer,
} from '~/app/components/ui'
import type { SessionUser } from '~/app/features/auth/types/types'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import {
  type Companies,
  type Team,
  TeamSwitcher,
} from '~/app/routes/company-switcher'

interface AppLayoutProps {
  user?: SessionUser
  companies?: Companies[]
  selectedTeam?: Team
  children: React.ReactNode
}

const AppLayout = ({ user, children, companies = [] }: AppLayoutProps) => {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const { AppBreadcrumbs } = useBreadcrumbs()

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto]">
      <header className="flex items-center px-2 py-1 md:container">
        <HStack>
          <Heading>
            <Link to={isAdmin ? '/admin' : '/'}>
              UpFlow{' '}
              {isAdmin && <span className="text-destructive">Admin</span>}
            </Link>
          </Heading>

          {user && <TeamSwitcher companies={companies} isAdmin={isAdmin} />}
        </HStack>

        <Spacer />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar>
                  <AvatarImage
                    src={user.pictureUrl ?? undefined}
                    alt={user.displayName}
                  />
                  <AvatarFallback>{user.displayName}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <HStack>
                  <div>
                    <p className="text-sm">{user.displayName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Spacer />
                  <Badge
                    variant={user.role === 'admin' ? 'destructive' : 'default'}
                  >
                    {user.role}
                  </Badge>
                </HStack>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                {isAdmin ? (
                  <Link to="/">ユーザー画面</Link>
                ) : (
                  <Link to="/admin">管理画面</Link>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/logout">ログアウト</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <main className="max-w-screen flex flex-col overflow-auto bg-gray-200 pb-2 md:px-0">
        <div className="flex flex-1 flex-col px-2 md:container">
          <AppBreadcrumbs />
          <div className="flex-1">{children}</div>
        </div>
      </main>

      <footer className="p-2 text-center text-sm shadow">
        Copyright&copy;{' '}
        <a
          href="https://www.techtalk.jp/"
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary hover:underline"
        >
          TechTalk Inc.
        </a>
      </footer>
    </div>
  )
}
AppLayout.displayName = 'AppLayout'
export { AppLayout }
