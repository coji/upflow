import { z } from 'zod'
import { zx } from 'zodix'
import type { Route } from './+types/$company.teams.$team.users'

export const loader = ({ params }: Route.LoaderArgs) => {
  const { company: companyId, team: teamId } = zx.parseParams(params, {
    company: z.string(),
    team: z.string(),
  })
  return { companyId, teamId }
}

export default function TeamUsers({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>TeamUsers</h1>
    </div>
  )
}
