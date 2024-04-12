import { DropdownMenuGroup } from '@radix-ui/react-dropdown-menu'
import { CaretSortIcon } from '@radix-ui/react-icons'
import { Link } from '@remix-run/react'
import { useState } from 'react'
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/app/components/ui'
import { cn } from '~/app/libs/utils'

export interface Companies {
  id: string
  name: string
  teams: Team[]
}

export interface Team {
  id: string
  name: string
}

interface TeamSwitcherProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger> {
  companies: Companies[]
  selectedTeam?: Team
  isAdmin: boolean
}

export const TeamSwitcher = ({
  className,
  companies,
  selectedTeam,
  isAdmin,
}: TeamSwitcherProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn('w-[10rem] justify-between md:w-[12rem]', className)}
        >
          {selectedTeam ? (
            <>
              <Avatar className="mr-2 h-5 w-5">
                <AvatarFallback>{selectedTeam.name}</AvatarFallback>
              </Avatar>
              {selectedTeam.name}
              <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : (
            <div>Select Company...</div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[10rem] p-0 md:w-[12rem]">
        {companies.map((company) => (
          <DropdownMenuGroup key={company.id}>
            <DropdownMenuItem asChild>
              <Link to={isAdmin ? `/admin/${company.id}` : `/${company.id}`}>
                {company.name}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
