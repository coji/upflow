import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@remix-run/node'
import { Link, Outlet, useLoaderData } from '@remix-run/react'
import { SettingsIcon } from 'lucide-react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HStack,
  Separator,
  Spacer,
  Stack,
} from '~/app/components/ui'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import { getCompany } from '~/app/models/admin/company.server'
import { CompanyNavLink } from './components'

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.company.name} - Upflow Admin` },
]

export const handle = {
  breadcrumb: ({
    company,
  }: {
    company: NonNullable<Awaited<ReturnType<typeof getCompany>>>
  }) => {
    return {
      label: company.name,
      to: $path('/admin', { companyId: company.id }),
    }
  },
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json({ companyId, company })
}

export default function CompanyLayout() {
  const { companyId, company } = useLoaderData<typeof loader>()
  const { AppBreadcrumbs } = useBreadcrumbs()

  return (
    <div className="grid min-h-full grid-cols-[auto_1fr] gap-2">
      <div>
        <Card className="flex w-48 flex-col gap-0.5 py-2">
          <HStack className="items-start px-4">
            <CardTitle>{company.name}</CardTitle>

            <Spacer />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to={$path('/admin/:companyId/settings', { companyId })}>
                    Config
                  </Link>
                </DropdownMenuItem>
                {company.exportSetting && (
                  <DropdownMenuItem asChild>
                    <Link to="export-setting">
                      {company.exportSetting
                        ? 'Export Settings'
                        : 'Add Export Setting'}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link
                    to={$path('/admin/:companyId/delete', { companyId })}
                    className="text-destructive"
                  >
                    Delete
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </HStack>

          <Separator />

          <Stack className="flex-1 gap-0 overflow-hidden bg-popover text-popover-foreground transition-colors">
            <CompanyNavLink
              to={$path('/admin/:companyId/users', { companyId })}
            >
              Users
            </CompanyNavLink>

            <CompanyNavLink
              to={$path('/admin/:companyId/teams', { companyId })}
            >
              Teams
            </CompanyNavLink>

            <CompanyNavLink
              to={$path('/admin/:companyId/repositories', { companyId })}
            >
              Repositories
            </CompanyNavLink>
          </Stack>

          <Separator />

          <Stack>
            <CompanyNavLink
              to={$path('/admin/:companyId/settings', { companyId })}
            >
              Settings
            </CompanyNavLink>
          </Stack>
        </Card>
      </div>

      <div>
        <>
          <AppBreadcrumbs />
          <Outlet />
        </>
      </div>
    </div>
  )
}
