import { href, Link } from 'react-router'
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
  Heading,
  HStack,
  Spacer,
} from '~/app/components/ui'
import { CompanySwitcher } from '~/app/routes/resources+/company/route'
import { useSession } from '../libs/auth-client'

interface AppHeaderProps {
  isAdmin?: boolean
}

export const AppHeader = ({ isAdmin = false }: AppHeaderProps) => {
  const { data: session } = useSession()
  const user = session?.user

  return (
    <header className="flex items-center px-4 py-1">
      <HStack>
        <Heading>
          <Link to={isAdmin ? href('/admin') : href('/')}>
            UpFlow {isAdmin && <span className="text-destructive">Admin</span>}
          </Link>
        </Heading>

        {session && <CompanySwitcher isAdmin={isAdmin} />}
      </HStack>

      <Spacer />

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback>{user.name}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <HStack>
                <div>
                  <p className="text-sm">{user.name}</p>
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
                <Link to={href('/')}>ユーザー画面</Link>
              ) : (
                <Link to={href('/admin')}>管理画面</Link>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={href('/logout')}>ログアウト</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
