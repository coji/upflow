import { DropdownMenuGroup } from '@radix-ui/react-dropdown-menu'
import { CaretSortIcon } from '@radix-ui/react-icons'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/app/components/ui'
import { requireUser } from '~/app/features/auth/services/user-session.server'
import { cn } from '~/app/libs/utils'
import { listUserCompanies } from './functions.server'

interface TeamSwitcherProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger> {
  currentCompanyId?: string
  isAdmin: boolean
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request)
  const companies = await listUserCompanies(user.id)
  return json({ user, companies })
}

export const CompanySwitcher = ({
  className,
  currentCompanyId,
  isAdmin,
}: TeamSwitcherProps) => {
  const fetcher = useFetcher<typeof loader>()
  const [open, setOpen] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetcher.load('/resources/company')
  }, [])

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
          {currentCompany ? (
            <>
              <Avatar className="mr-2 h-5 w-5">
                <AvatarFallback>{currentCompany.name}</AvatarFallback>
              </Avatar>
              {currentCompany.name}
              <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : (
            <div>Select Company...</div>
          )}
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
