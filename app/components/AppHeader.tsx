import { Link } from 'react-router'
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
import { CompanySwitcher } from '~/app/routes/resources+/company/route'

interface AppHeaderProps {
  user?: SessionUser
  isAdmin?: boolean
}

export const AppHeader = ({ user, isAdmin = false }: AppHeaderProps) => {
  return (
    <header className="flex items-center px-4 py-1">
      <HStack>
        <Heading>
          <Link to={isAdmin ? '/admin' : '/'}>
            UpFlow {isAdmin && <span className="text-destructive">Admin</span>}
          </Link>
        </Heading>

        {user && <CompanySwitcher isAdmin={isAdmin} />}
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
