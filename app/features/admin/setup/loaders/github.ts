import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { z } from 'zod'
import { listGithubRepos } from '../services/listGithubRepos'

export const schema = z.object({
  token: z.string({ required_error: 'token should specified' }),
})

export const loader = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) {
    throw new Response('token should specified')
  }

  const ret = await listGithubRepos(token)
  return json(ret)
}
