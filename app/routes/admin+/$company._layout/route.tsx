import type { LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData, type MetaArgs } from '@remix-run/react'
import { $path } from 'remix-routes'
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

export const meta = ({ data }: MetaArgs<typeof loader>) => [
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
      to: $path('/admin/:company', { company: company.id }),
    }
  },
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return { companyId, company }
}

export default function CompanyLayout() {
  const { companyId, company } = useLoaderData<typeof loader>()
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
                to={$path('/admin/:company/users', { company: companyId })}
              >
                Users
              </CompanyNavLink>

              <CompanyNavLink
                to={$path('/admin/:company/teams', { company: companyId })}
              >
                Teams
              </CompanyNavLink>

              <CompanyNavLink
                to={$path('/admin/:company/repositories', {
                  company: companyId,
                })}
              >
                Repositories
              </CompanyNavLink>
            </Stack>
          </CardContent>

          <CardFooter>
            <CompanyNavLink
              to={$path('/admin/:company/settings', { company: companyId })}
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
