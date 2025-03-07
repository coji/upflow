import { href, Link } from 'react-router'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  HStack,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import type { Route } from './+types/route'
import { listCompanyTeams } from './queries.server'

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const teams = await listCompanyTeams(companyId)
  return { companyId, teams }
}

export default function TeamIndexPage({
  loaderData: { companyId, teams },
}: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
      </CardHeader>

      <CardContent>
        <Stack>
          <div className="rounded-lg border shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Repositories</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>{team.id}</TableCell>
                    <TableCell>{team.name}</TableCell>
                    <TableCell>{team.userCount}</TableCell>
                    <TableCell>{team.repositoryCount}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          to={href('/admin/:company/teams/:team', {
                            company: companyId,
                            team: team.id,
                          })}
                        >
                          詳細
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Stack>
      </CardContent>

      <CardFooter>
        <HStack>
          <Button asChild>
            <Link
              to={href('/admin/:company/teams/add', { company: companyId })}
            >
              Add Team
            </Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
