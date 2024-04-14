import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@remix-run/node'
import { Link, Outlet, useLoaderData, useLocation } from '@remix-run/react'
import { SettingsIcon } from 'lucide-react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Badge,
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
import { getCompany } from '~/app/models/admin/company.server'
import { CompanyNavLink } from './components/'

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
  return json({ company })
}

export default function CompanyLayout() {
  const { company } = useLoaderData<typeof loader>()
  const companyId = company.id
  const location = useLocation()
  const tabValue = location.pathname.split('/')?.[3] ?? 'company'

  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div>
        <Card className="w-60">
          <CardHeader>
            <Stack direction="row" className="items-start">
              <CardTitle>
                <HStack>
                  <div>{company.name}</div>
                  <Badge variant="outline">Company</Badge>
                </HStack>
              </CardTitle>

              <Spacer />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link to={$path('/admin/:companyId/config', { companyId })}>
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
            </Stack>
          </CardHeader>

          <CardContent className="px-4">
            <Stack>
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

              <CompanyNavLink
                to={$path('/admin/:companyId/users', { companyId })}
              >
                Users
              </CompanyNavLink>
            </Stack>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardContent className="pt-6">
            <Outlet />
          </CardContent>
          <CardFooter />
        </Card>
      </div>
    </div>
  )
}
