import { DropdownMenuGroup } from '@radix-ui/react-dropdown-menu'
import { CaretSortIcon } from '@radix-ui/react-icons'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/app/components/ui'
import { requireUser } from '~/app/features/auth/services/user-session.server'
import { cn } from '~/app/libs/utils'
import { listUserCompanies } from './functions.server'
import { useCurrentCompany } from './hooks/useCurrentCompany'

export const loader = async ({ request }: LoaderFunctionArgs) => {
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetcher.load('/resources/company')
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
          role="combobox"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn('w-[10rem] justify-between md:w-[12rem]', className)}
        >
          <div>
            {currentCompany ? currentCompany.name : 'Select Company...'}
          </div>
          <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[10rem] p-0 md:w-[12rem]">
        {fetcher.data?.companies.map((company) => (
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
