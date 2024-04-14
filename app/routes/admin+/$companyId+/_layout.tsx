import { GearIcon } from '@radix-ui/react-icons'
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@remix-run/node'
import { Link, Outlet, useLoaderData, useLocation } from '@remix-run/react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HStack,
  Spacer,
  Stack,
  Tabs,
  TabsList,
  TabsTrigger,
} from '~/app/components/ui'
import { getCompany } from '~/app/models/admin/company.server'

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
    <Card>
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
              <Button size="icon" variant="outline">
                <GearIcon />
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

        <Tabs value={tabValue}>
          <TabsList>
            <TabsTrigger value="company" asChild>
              <Link to={$path('/admin/:companyId', { companyId })}>
                Company
              </Link>
            </TabsTrigger>
            <TabsTrigger value="teams" asChild>
              <Link to={$path('/admin/:companyId/teams', { companyId })}>
                Teams
              </Link>
            </TabsTrigger>
            <TabsTrigger value="repositories" asChild>
              <Link
                to={$path('/admin/:companyId/repositories', {
                  companyId,
                })}
              >
                Repositories
              </Link>
            </TabsTrigger>
            <TabsTrigger value="users" asChild>
              <Link to={$path('/admin/:companyId/users', { companyId })}>
                Users
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        <Outlet />
      </CardContent>
    </Card>
  )
}
