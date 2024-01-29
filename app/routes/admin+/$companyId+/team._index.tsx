import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { Button, Stack, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/app/components/ui'
import { listTeams } from '~/app/models/admin/team.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const teams = await listTeams(companyId)
  return json({ companyId, teams })
}

export default function TeamIndexPage() {
  const { teams } = useLoaderData<typeof loader>()

  return (
    <Stack>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>チーム名</TableHead>
            <TableHead>ユーザ数</TableHead>
            <TableHead>リポジトリ数</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {teams.map((team) => (
            <TableRow key={team.id}>
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
    </Stack>
  )
}
