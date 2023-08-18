import { parse } from '@conform-to/zod'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useFetcher, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label } from '~/app/components/ui'
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

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const integration = await getIntegration(companyId)
  if (!integration) {
    throw new Error('integration not created')
  }
  return { integration }
}

export const action = async ({ request, params }: ActionArgs) => {
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

      {integration.provider === 'gitlab' && (
        <Card>
          <CardHeader>
            <CardTitle>Add GitLab Repositories</CardTitle>
          </CardHeader>
          <CardContent></CardContent>
          <CardFooter>
            <Form method="POST">
              GitLab
              <fieldset>
                <Label htmlFor="projectId">Project ID</Label>
                <Input id="projectId" name="repos[0].projectId"></Input>
              </fieldset>
            </Form>
          </CardFooter>
        </Card>
      )}
      <fetcher.Form method="post"></fetcher.Form>
    </>
  )
}
export default AddRepositoryModal
