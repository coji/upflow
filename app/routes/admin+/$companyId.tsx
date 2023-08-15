import { GearIcon } from '@radix-ui/react-icons'
import { json, type LoaderArgs, type V2_MetaFunction } from '@remix-run/node'
import { Link, Outlet, useLoaderData, useLocation } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spacer,
  Stack,
  Tabs,
  TabsList,
  TabsTrigger,
} from '~/app/components/ui'
import { getCompany } from '~/app/models/admin/company.server'

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [{ title: `${data?.company.name} - Upflow Admin` }]

export const handle = {
  breadcrumb: ({ company }: { company: NonNullable<Awaited<ReturnType<typeof getCompany>>> }) => {
    return { label: company.name, to: `/admin/${company.id}` }
  },
}

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json({ company })
}

export default function CompanyLayout() {
  const { company } = useLoaderData<typeof loader>()
  const location = useLocation()
  const tabValue = location.pathname.split('/')?.[3] ?? 'company'

  return (
    <Card>
      <CardHeader>
        <Stack direction="row" className="items-start">
          <CardTitle>{company.name}</CardTitle>

          <Spacer />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline">
                <GearIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link to="config">Config</Link>
              </DropdownMenuItem>
              {company.exportSetting && (
                <DropdownMenuItem asChild>
                  <Link to="export-setting">{company.exportSetting ? 'Export Settings' : 'Add Export Setting'}</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="delete" className="text-destructive">
                  Delete
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Stack>
        <Tabs value={tabValue}>
          <TabsList>
            <TabsTrigger value="company" asChild>
              <Link to=".">Company</Link>
            </TabsTrigger>
            <TabsTrigger value="team" asChild>
              <Link to="team">Team</Link>
            </TabsTrigger>
            <TabsTrigger value="repository" asChild>
              <Link to="repository">Repository</Link>
            </TabsTrigger>
            <TabsTrigger value="user" asChild>
              <Link to="user">User</Link>
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
