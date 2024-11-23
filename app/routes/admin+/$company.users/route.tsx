import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData } from 'react-router'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { Card, CardContent, CardHeader, CardTitle } from '~/app/components/ui'
import { listCompanyUsers } from './queries.server'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Users',
    to: $path('/admin/:company/users', { company: companyId }),
  }),
}
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const users = await listCompanyUsers(companyId)
  return { companyId, users }
}

export default function CompanyUsersPage() {
  const { users } = useLoaderData<typeof loader>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Users</CardTitle>
      </CardHeader>
      <CardContent>{JSON.stringify(users)}</CardContent>
    </Card>
  )
}
