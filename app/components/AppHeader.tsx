import { href, Link, useNavigate } from 'react-router'
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
import { authClient } from '~/app/libs/auth-client'
import { OrganizationSwitcher } from '~/app/routes/resources+/organization/route'

interface AppHeaderProps {
  isAdmin?: boolean
}

export const AppHeader = ({ isAdmin = false }: AppHeaderProps) => {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const user = session?.user

  return (
    <header className="flex items-center px-4 py-1">
      <HStack>
        <Heading>
          <Link to={isAdmin ? href('/admin') : href('/')}>
            UpFlow {isAdmin && <span className="text-destructive">Admin</span>}
          </Link>
        </Heading>

        {session && <OrganizationSwitcher isAdmin={isAdmin} />}
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
            <DropdownMenuItem
              onClick={() => {
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      navigate(href('/'))
                    },
                  },
                })
              }}
            >
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
