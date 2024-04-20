import { parseWithZod } from '@conform-to/zod'
import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { useRepositoryAddModal } from '~/app/features/admin/setup/hooks/useRepositoryAddModal'
import type { GithubRepo } from '~/app/features/admin/setup/interfaces/model'

import { addRepository, getIntegration } from './functions.server'

export const handle = { breadcrumb: () => ({ label: 'Add Repositories' }) }

const RepoSchema = z.object({
  repos: z.array(
    z.object({
      owner: z.string(),
      repo: z.string(),
    }),
  ),
})

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const integration = await getIntegration(companyId)
  if (!integration) {
    throw new Error('integration not created')
  }
  return { integration }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })

  const submission = parseWithZod(await request.formData(), {
    schema: RepoSchema,
  })
  if (submission.status !== 'success') {
    return json(submission.reply())
  }

  const integraiton = await getIntegration(companyId)
  if (!integraiton) {
    throw new Error('integration not created')
  }

  try {
    const repos = submission.value.repos
    for (const repo of repos) {
      await addRepository(companyId, {
        owner: repo.owner,
        repo: repo.repo,
      })
    }
  } catch (e) {
    return json(
      submission.reply({
        formErrors: ['Failed to add repository'],
      }),
    )
  }
  return redirect($path('/admin/:companyId/repositories', { companyId }))
}

export default function AddRepositoryPage() {
  const fetcher = useFetcher()
  const { integration } = useLoaderData<typeof loader>()

  const handleAddRepository = (repos: GithubRepo[]) => {
    const keyValues: Record<string, string> = {}
    for (const [idx, repo] of repos.entries()) {
      keyValues[`repos[${idx}].owner`] = repo.owner
      keyValues[`repos[${idx}].repo`] = repo.name
    }
    fetcher.submit(keyValues, { method: 'POST' })
    return true
  }
  const { RepositoryAddModal } = useRepositoryAddModal({
    integration,
    onSubmit: handleAddRepository,
  })

  if (!integration) {
    return <p>integration not found</p>
  }

  return <>{integration.provider === 'github' && RepositoryAddModal}</>
}
