import { Link } from '@remix-run/react'
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
import {
  TeamSwitcher,
  type Companies,
  type Team,
} from '~/app/routes/company-switcher'

interface AppHeaderProps {
  user?: SessionUser
  isAdmin?: boolean
  companies?: Companies[]
  selectedTeam?: Team
}

export const AppHeader = ({
  user,
  isAdmin = false,
  companies = [],
}: AppHeaderProps) => {
  return (
    <header className="flex items-center px-2 py-1 md:container">
      <HStack>
        <Heading>
          <Link to={isAdmin ? '/admin' : '/'}>
            UpFlow {isAdmin && <span className="text-destructive">Admin</span>}
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
  )
}
