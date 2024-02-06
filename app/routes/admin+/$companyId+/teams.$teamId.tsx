import { TabsList } from '@radix-ui/react-tabs'
import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { Badge, HStack, Stack, Tabs, TabsTrigger } from '~/app/components/ui'
import { listTeamRepository } from '~/app/models/admin/team-repository.server'
import { listTeamUsers } from '~/app/models/admin/team-users.server'
import { type Team, getTeam } from '~/app/models/admin/team.server'

export const handle = {
  breadcrumb: ({ team }: { team: Team }) => ({
    label: team.name,
    to: `/admin/${team.companyId}/team/${team.id}`,
  }),
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { companyId, teamId } = zx.parseParams(params, {
    companyId: z.string(),
    teamId: z.string(),
  })

  const team = await getTeam(teamId)
  if (!team) {
    throw new Response('Not Found', { status: 404 })
  }
  if (team.companyId !== companyId) {
    throw new Response('Not Found', { status: 404 })
  }

  const [users, repositories] = await Promise.all([
    listTeamUsers(teamId),
    listTeamRepository(teamId),
  ])

  return json({ team, repositories, users })
}

export default function CompanyTeamIndex() {
  const { team, repositories, users } = useLoaderData<typeof loader>()

  return (
    <div>
      <HStack>
        <h1 className="font-bold text-2xl">{team.name}</h1>
        <div>
          <Badge variant="outline">Team</Badge>
        </div>
      </HStack>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stack>
          <div className="font-bold text-lg">Team Members</div>
          {users.map((user) => (
            <div key={user.userId}>
              {user.role} {user.user.displayName}
            </div>
          ))}
        </Stack>

        <Stack>
          <div className="font-bold text-lg">Team Repositories</div>
          {repositories.map((repository) => (
            <div key={repository.repositoryId}>{repository.teamId}</div>
          ))}
        </Stack>
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
