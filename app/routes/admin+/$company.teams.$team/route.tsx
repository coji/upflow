import { unstable_defineLoader as defineLoader } from '@remix-run/node'
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
import {
  getTeam,
  listTeamRepositories,
  listTeamUsers,
  type Team,
} from './queries.server'

export const handle = {
  breadcrumb: ({ team }: { team: Team }) => ({
    label: team.name,
    to: `/admin/${team}/team/${team.id}`,
  }),
}

export const loader = defineLoader(async ({ params }) => {
  const { company: companyId, team: teamId } = zx.parseParams(params, {
    company: z.string(),
    team: z.string(),
  })

  const team = await getTeam(companyId, teamId)
  if (!team) {
    throw new Response('Not Found', { status: 404 })
  }

  const [users, repositories] = await Promise.all([
    listTeamUsers(teamId),
    listTeamRepositories(teamId),
  ])

  return { team, repositories, users }
})

export default function CompanyTeamIndex() {
  const { team, repositories, users } = useLoaderData<typeof loader>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {team.name} <Badge variant="outline">Team</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage your team members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack>
              {users.map((user) => (
                <div key={user.id}>
                  <HStack>
                    <Avatar>
                      <AvatarImage src={user.pictureUrl ?? undefined} />
                      <AvatarFallback>{user.displayName}</AvatarFallback>
                    </Avatar>
                    <h3 className="font-medium">{user.displayName}</h3>
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
      </CardContent>

      <div>
        <Outlet />
      </div>
    </Card>
  )
}
