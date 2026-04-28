import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'

interface AuthorBadgeProps {
  login: string
  displayName?: string | null
}

/**
 * 24px GitHub avatar + display name (falls back to login). Used in tables
 * across throughput and analysis screens.
 */
export function AuthorBadge({ login, displayName }: AuthorBadgeProps) {
  const name = displayName?.trim() || login
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6 shrink-0">
        <AvatarImage
          src={`https://github.com/${login}.png?size=48`}
          alt={login}
        />
        <AvatarFallback className="text-xs">
          {login.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="line-clamp-1 min-w-0">{name}</span>
    </div>
  )
}
