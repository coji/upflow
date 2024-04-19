import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Link, Outlet } from '@remix-run/react'
import { SettingsIcon } from 'lucide-react'
import { $path } from 'remix-routes'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HStack,
  Spacer,
  Stack,
} from '~/app/components/ui'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import { CompanyNavLink } from './components'
import { getCompany } from './functions.server'

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
      to: $path('/admin/:companyId', { companyId: company.id }),
    }
  },
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return typedjson({ companyId, company })
}

export default function CompanyLayout() {
  const { companyId, company } = useTypedLoaderData<typeof loader>()
  const { AppBreadcrumbs } = useBreadcrumbs()

  return (
    <div className="grid min-h-full grid-cols-[auto_1fr] gap-2">
      <div>
        <Card className="w-60">
          <CardHeader>
            <HStack className="items-start">
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
                    <Link
                      to={$path('/admin/:companyId/settings', {
                        companyId,
                      })}
                    >
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to={$path('/admin/:companyId/settings/export', {
                        companyId,
                      })}
                    >
                      Export Settings
                    </Link>
                  </DropdownMenuItem>

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
          </CardHeader>

          <CardContent>
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
          </CardContent>

          <CardFooter>
            <CompanyNavLink
              to={$path('/admin/:companyId/settings', { companyId })}
            >
              Settings
            </CompanyNavLink>
          </CardFooter>
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
