import { UsersIcon } from 'lucide-react'
import { useRevalidator } from 'react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'

interface Team {
  id: string
  name: string
}

const COOKIE_MAX_AGE = 2592000 // 30 days

function setTeamCookie(teamId: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: matches sidebar_state cookie pattern in sidebar.tsx
  document.cookie = `selected_team=${encodeURIComponent(teamId)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

function clearTeamCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: matches sidebar_state cookie pattern in sidebar.tsx
  document.cookie = 'selected_team=; path=/; max-age=0; samesite=lax'
}

export function TeamSwitcher({
  teams,
  selectedTeamId,
}: {
  teams: Team[]
  selectedTeamId: string | null
}) {
  const revalidator = useRevalidator()

  if (teams.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-2 group-data-[collapsible=icon]:px-0">
      <UsersIcon className="text-muted-foreground size-4 shrink-0 group-data-[collapsible=icon]:mx-auto" />
      <Select
        value={selectedTeamId ?? '__all__'}
        onValueChange={(value) => {
          if (value === '__all__') {
            clearTeamCookie()
          } else {
            setTeamCookie(value)
          }
          revalidator.revalidate()
        }}
      >
        <SelectTrigger className="h-7 border-none bg-transparent px-1 text-xs shadow-none group-data-[collapsible=icon]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Teams</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
