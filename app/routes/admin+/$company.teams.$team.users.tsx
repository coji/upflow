import { unstable_defineLoader as defineLoader } from '@remix-run/node'
import { z } from 'zod'
import { zx } from 'zodix'

export const loader = defineLoader(({ params }) => {
  const { company: companyId, team: teamId } = zx.parseParams(params, {
    company: z.string(),
    team: z.string(),
  })
  return { companyId, teamId }
})

export default function TeamUsers() {
  return (
    <div>
      <h1>TeamUsers</h1>
    </div>
  )
}
