import { LoaderFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { listTeamRepository } from '~/app/models/admin/team-repository.server'
import { listTeamUsers } from '~/app/models/admin/team-users.server'
import { getTeam } from '~/app/models/admin/team.server'

export const handle = {
  breadcrumb: ({ companyId, team }: { companyId: string; team: NonNullable<Awaited<ReturnType<typeof getTeam>>> }) => ({
    label: team.name,
    to: `/admin/${companyId}/team/${team.id}`,
  }),
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId, teamId } = zx.parseParams(params, { companyId: z.string(), teamId: z.string() })

  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('チームが見つかりません')
  }

  const [teamUsers, teamRepositories] = await Promise.all([
    await listTeamUsers(teamId),
    await listTeamRepository(teamId),
  ])

  return json({
    companyId,
    team,
    teamUsers,
    teamRepositories,
  })
}

export default function TeamDetailPage() {
  const { teamUsers, teamRepositories } = useLoaderData<typeof loader>()

  return (
    <div>
      TeamDetailPage
      <div>{JSON.stringify(teamUsers)}</div>
      <div>{JSON.stringify(teamRepositories)}</div>
    </div>
  )
}
