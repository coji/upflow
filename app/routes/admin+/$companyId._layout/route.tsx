import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { $path } from 'remix-routes'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
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
            <CardTitle>{company.name}</CardTitle>
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