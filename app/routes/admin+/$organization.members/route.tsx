import { href } from 'react-router'
import { z } from 'zod'
import { zx } from 'zodix'
import { Card, CardContent, CardHeader, CardTitle } from '~/app/components/ui'
import type { Route } from './+types/route'
import { listOrganizationMembers } from './queries.server'

export const handle = {
  breadcrumb: ({ organizationId }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Users',
    to: href('/admin/:organization/members', { organization: organizationId }),
  }),
}
export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization: organizationId } = zx.parseParams(params, {
    organization: z.string(),
  })
  const members = await listOrganizationMembers(organizationId)
  return { organizationId, members }
}

export default function OrganizationMembersPage({
  loaderData: { members },
}: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Members</CardTitle>
      </CardHeader>
      <CardContent>{JSON.stringify(members)}</CardContent>
    </Card>
  )
}
