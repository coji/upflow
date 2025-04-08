import { ChevronsUpDownIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { href, Link, useFetcher } from 'react-router'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/app/components/ui'
import { requireUser } from '~/app/libs/auth.server'
import { cn } from '~/app/libs/utils'
import type { Route } from './+types/route'
import { listUserOrganizations } from './functions.server'
import { useCurrentOrganization } from './hooks/useCurrentOrganization'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const user = await requireUser(request)
  const organizations = await listUserOrganizations(user.id)

  return { user, organizations }
}

interface OrganizationSwitcherProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger> {
  isAdmin: boolean
}
export const OrganizationSwitcher = ({
  className,
  isAdmin,
}: OrganizationSwitcherProps) => {
  const fetcher = useFetcher<typeof loader>()
  const [open, setOpen] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetcher.load(href('/resources/organization'))
  }, [])

  const currentOrganizationId = useCurrentOrganization()

  const currentOrganization = fetcher.data?.organizations.find(
    (org) => org.id === currentOrganizationId,
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn('w-[10rem] justify-between md:w-[12rem]', className)}
        >
          <div>
            {currentOrganization
              ? currentOrganization.name
              : 'Select Organization...'}
          </div>
          <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[10rem] p-0 md:w-[12rem]">
        {fetcher.data?.organizations.map((organization) => (
          <DropdownMenuGroup key={organization.id}>
            <DropdownMenuItem asChild>
              <Link
                to={
                  isAdmin
                    ? href('/admin/:organization', {
                        organization: organization.id,
                      })
                    : href('/:organization', { organization: organization.id })
                }
              >
                {organization.name}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
