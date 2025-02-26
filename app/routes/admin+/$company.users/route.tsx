import { $path } from 'safe-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { Card, CardContent, CardHeader, CardTitle } from '~/app/components/ui'
import type { Route } from './+types/route'
import { listCompanyUsers } from './queries.server'

export const handle = {
  breadcrumb: ({ companyId }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Users',
    to: $path('/admin/:company/users', { company: companyId }),
  }),
}
export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const users = await listCompanyUsers(companyId)
  return { companyId, users }
}

export default function CompanyUsersPage({
  loaderData: { users },
}: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Users</CardTitle>
      </CardHeader>
      <CardContent>{JSON.stringify(users)}</CardContent>
    </Card>
  )
}
