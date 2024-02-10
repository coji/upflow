import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { listCompanyUsers } from '~/app/models/admin/company-users.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, {
    companyId: z.string(),
  })
  const users = await listCompanyUsers(companyId)
  return json({ companyId, users })
}

export default function CompanyUsersPage() {
  const { users } = useLoaderData<typeof loader>()

  return <div>Company Users {JSON.stringify(users)}</div>
}
