import { ChevronsUpDown, UsersIcon } from 'lucide-react'
import { useRevalidator } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/app/components/ui/sidebar'

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
  const { isMobile } = useSidebar()
  const revalidator = useRevalidator()

  if (teams.length === 0) return null

  const selectedTeam = selectedTeamId
    ? teams.find((t) => t.id === selectedTeamId)
    : null
  const displayName = selectedTeam?.name ?? 'All Teams'

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-bold">
                {selectedTeam ? (
                  selectedTeam.name.slice(0, 2).toUpperCase()
                ) : (
                  <UsersIcon className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs">Team</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Teams
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                clearTeamCookie()
                revalidator.revalidate()
              }}
              className="gap-2 p-2"
            >
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <UsersIcon className="size-3" />
              </div>
              <span className="flex-1 truncate">All Teams</span>
              {!selectedTeamId && (
                <span className="text-muted-foreground text-xs">current</span>
              )}
            </DropdownMenuItem>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => {
                  setTeamCookie(team.id)
                  revalidator.revalidate()
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border text-xs font-bold">
                  {team.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 truncate">{team.name}</span>
                {team.id === selectedTeamId && (
                  <span className="text-muted-foreground text-xs">current</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
