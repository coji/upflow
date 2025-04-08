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
import { authClient } from '~/app/libs/auth-client'
import { requireUser } from '~/app/libs/auth.server'
import { cn } from '~/app/libs/utils'
import type { Route } from './+types/route'
import { listUserCompanies } from './functions.server'
import { useCurrentCompany } from './hooks/useCurrentCompany'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const user = await requireUser(request)
  const companies = await listUserCompanies(user.id)

  return { user, companies }
}

interface CompanySwitcherProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger> {
  isAdmin: boolean
}
export const CompanySwitcher = ({
  className,
  isAdmin,
}: CompanySwitcherProps) => {
  const fetcher = useFetcher<typeof loader>()
  const [open, setOpen] = useState(false)
  const { data: organizations } = authClient.useListOrganizations()
  const { data: activeOrganization } = authClient.useActiveOrganization()

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetcher.load(href('/resources/company'))
  }, [])

  const currentCompanyId = useCurrentCompany()

  const currentCompany = fetcher.data?.companies.find(
    (company) => company.id === currentCompanyId,
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
            {currentCompany ? currentCompany.name : 'Select Company...'}
          </div>
          <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[10rem] p-0 md:w-[12rem]">
        {fetcher.data?.companies.map((company) => (
          <DropdownMenuGroup key={company.id}>
            <DropdownMenuItem asChild>
              <Link
                to={
                  isAdmin
                    ? href('/admin/:company', { company: company.id })
                    : href('/:company', { company: company.id })
                }
              >
                {company.name}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
