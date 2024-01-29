import { parse } from '@conform-to/zod'
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { useRepositoryAddModal } from '~/app/features/admin/setup/hooks/useRepositoryAddModal'
import type { GithubRepo } from '~/app/features/admin/setup/interfaces/model'
import { getIntegration } from '~/app/models/admin/integration.server'
import { createRepository } from '~/app/models/admin/repository.server'

export const handle = { breadcrumb: () => ({ label: 'Add Repositories' }) }

const RepoSchema = z.object({
  repos: z.array(
    z.object({
      projectId: z.string().optional(),
      owner: z.string().optional(),
      repo: z.string().optional(),
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

  const submission = parse(await request.formData(), { schema: RepoSchema })
  if (!submission.value) {
    throw new Error('invalid submission')
  }
  const repos = submission.value.repos
  console.log('repos', repos)

  for (const repo of repos) {
    await createRepository({
      companyId,
      projectId: repo.projectId,
      owner: repo.owner,
      repo: repo.repo,
    })
  }
  return redirect(`/admin/${params.companyId}/repository`)
}

const AddRepositoryModal = () => {
  const fetcher = useFetcher()
  const { integration } = useLoaderData<typeof loader>()

  const handleAddRepository = async (repos: GithubRepo[]) => {
    const keyValues: Record<string, string> = {}
    for (const [idx, repo] of repos.entries()) {
      keyValues[`repos[${idx}].owner`] = repo.owner
      keyValues[`repos[${idx}].repo`] = repo.name
    }
    fetcher.submit(keyValues, { method: 'post' })
    return true
  }
  const { RepositoryAddModal } = useRepositoryAddModal({ integration, onSubmit: handleAddRepository })

  if (!integration) {
    return <p>integration not found</p>
  }

  return (
    <>
      {integration.provider === 'github' && RepositoryAddModal}
      <fetcher.Form method="POST" />
    </>
  )
}
export default AddRepositoryModal
