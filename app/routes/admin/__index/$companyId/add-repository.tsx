import { Box } from '@chakra-ui/react'
import { redirect } from '@remix-run/node'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { zfd } from 'zod-form-data'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { getIntegration } from '~/app/models/admin/integration.server'
import { useRepositoryAddModal } from '~/app/features/admin/setup/hooks/useRepositoryAddModal'
import { createRepository } from '~/app/models/admin/repository.server'
import type { GitRepo } from '~/app/features/admin/setup/interfaces/model'

const RepoSchema = zfd.formData({
  repos: z.array(
    z.object({
      projectId: z.string().optional(),
      owner: z.string().optional(),
      repo: z.string().optional(),
    }),
  ),
})

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.companyId, 'company id shoud specified')
  const integration = getIntegration(params.companyId)
  if (!integration) {
    throw new Error('integration not created')
  }
  return integration
}

export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.companyId, 'company id shoud specified')

  const { repos } = RepoSchema.parse(await request.formData())
  console.log('repos', repos)

  for (const repo of repos) {
    await createRepository({
      companyId: params.companyId,
      projectId: repo.projectId,
      owner: repo.owner,
      repo: repo.repo,
    })
  }
  return redirect(`/admin/${params.companyId}`)
}

const AddRepositoryModal = () => {
  const fetcher = useFetcher()
  const integration = useLoaderData<typeof loader>()

  const handleAddRepository = async (repos: GitRepo[]) => {
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
    return <Box>integration not found</Box>
  }

  return (
    <>
      {RepositoryAddModal}

      <fetcher.Form method="post"></fetcher.Form>
    </>
  )
}
export default AddRepositoryModal
