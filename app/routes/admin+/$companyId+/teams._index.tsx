import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  HStack,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import { listCompanyTeams } from '~/app/models/admin/team.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const teams = await listCompanyTeams(companyId)
  return json({ companyId, teams })
}

export default function TeamIndexPage() {
  const { teams } = useLoaderData<typeof loader>()

  return (
    <Stack>
      <HStack>
        <Button asChild>
          <Link to="add">Add Team</Link>
        </Button>
      </HStack>

      <div className="rounded-lg border shadow-sm">
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
                <TableCell>{team._count.teamUser}</TableCell>
                <TableCell>{team._count.TeamRepository}</TableCell>
                <TableCell>
                  <Button size="xs" variant="outline" asChild>
                    <Link to={`./${team.id}`}>詳細</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Stack>
  )
}
