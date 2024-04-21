import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { Card, CardContent, CardHeader, CardTitle } from '~/app/components/ui'
import { listCompanyUsers } from './queries.server'

export const handle = {
  breadcrumb: ({ companyId }: { companyId: string }) => ({
    label: 'Users',
    to: $path('/admin/:companyId/users', { companyId }),
  }),
}
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, {
    companyId: z.string(),
  })
  const users = await listCompanyUsers(companyId)
  return json({ companyId, users })
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
