import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { listTeams } from '~/app/models/admin/team.server'

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const teams = await listTeams(companyId)
  return json({ companyId, teams })
}
export default function TeamPage() {
  const { companyId, teams } = useLoaderData<typeof loader>()

  return (
    <div>
      {teams.map((team) => (
        <div key={team.id}>{team.name}</div>
      ))}
    </div>
  )
}
