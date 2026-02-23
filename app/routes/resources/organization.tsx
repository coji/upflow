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
import { listUserOrganizations } from '~/app/routes/resources/+organization/functions.server'
import { useCurrentOrganization } from '~/app/routes/resources/+organization/hooks/useCurrentOrganization'
import type { Route } from './+types/organization'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { user } = await requireUser(request)
  const organizations = await listUserOrganizations(user.id)

  return { user, organizations }
}

interface OrganizationSwitcherProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuTrigger
> {}
export const OrganizationSwitcher = ({
  className,
}: OrganizationSwitcherProps) => {
  const fetcher = useFetcher<typeof loader>()
  const [open, setOpen] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher.loadは安定している
  useEffect(() => {
    fetcher.load(href('/resources/organization'))
  }, [])

  const currentOrgSlug = useCurrentOrganization()

  const currentOrganization = fetcher.data?.organizations.find(
    (org) => org.slug === currentOrgSlug,
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn('w-40 justify-between md:w-48', className)}
        >
          <div>
            {currentOrganization
              ? currentOrganization.name
              : 'Select Organization...'}
          </div>
          <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40 p-0 md:w-48">
        {fetcher.data?.organizations.map((organization) => (
          <DropdownMenuGroup key={organization.id}>
            <DropdownMenuItem asChild>
              <Link to={`/${organization.slug}`}>{organization.name}</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
