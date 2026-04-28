import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'

interface AuthorBadgeProps {
  login: string
  displayName: string | null
}

export function AuthorBadge({ login, displayName }: AuthorBadgeProps) {
  const name = displayName?.trim() || login
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage
          src={`https://github.com/${login}.png?size=48`}
          alt={login}
        />
        <AvatarFallback className="text-xs">
          {login.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="line-clamp-1">{name}</span>
    </div>
  )
}
