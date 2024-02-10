import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  HStack,
  Spacer,
  Stack,
} from '~/app/components/ui'
import { listTeamRepository } from '~/app/models/admin/team-repository.server'
import { listTeamUsers } from '~/app/models/admin/team-users.server'
import { getTeam, type Team } from '~/app/models/admin/team.server'

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
    <Stack>
      <HStack>
        <h1 className="text-2xl font-bold">{team.name}</h1>
        <div>
          <Badge variant="outline">Team</Badge>
        </div>
      </HStack>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage your team members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack>
              {users.map((user) => (
                <div key={user.userId}>
                  <HStack>
                    <Avatar>
                      <AvatarImage src={user.user.pictureUrl ?? undefined} />
                      <AvatarFallback>{user.user.displayName}</AvatarFallback>
                    </Avatar>
                    <h3 className="font-medium">{user.user.displayName}</h3>
                    <Badge variant="secondary">{user.role}</Badge>

                    <Spacer />
                    <Button type="button" variant="outline" size="sm">
                      Remove
                    </Button>
                  </HStack>
                </div>
              ))}
            </Stack>
          </CardContent>
          <CardFooter>
            <div>
              <Button type="button" variant="outline">
                Add Member
              </Button>
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
            <CardDescription>Manage your team repositories.</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack>
              {repositories.map((repository) => (
                <div key={repository.repositoryId}>{repository.teamId}</div>
              ))}
            </Stack>
          </CardContent>
          <CardFooter>
            <div>
              <Button type="button" variant="outline">
                Add Repository
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      <div>
        <Outlet />
      </div>
    </Stack>
  )
}
