import { Card, CardContent, CardHeader, CardTitle } from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from './+types/route'
import { listOrganizationMembers } from './queries.server'

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Users',
    to: `/${organization.slug}/settings/members`,
  }),
}
export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const members = await listOrganizationMembers(organization.id)
  return { organization, members }
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
