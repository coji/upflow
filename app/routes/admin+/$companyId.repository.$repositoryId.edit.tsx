import { redirect, type ActionArgs, type LoaderArgs } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { match } from 'ts-pattern'
import { AppProviderBadge } from '~/app/components'
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, Stack } from '~/app/components/ui'
import { getRepository, updateRepository } from '~/app/models/admin/repository.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  invariant(params.repositoryId, 'company id should specified')
  const repository = getRepository(params.repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  return repository
}

export const action = async ({ request, params }: ActionArgs) => {
  const formData = await request.formData()
  invariant(params.repositoryId, 'repository id should specified')
  const entries = Object.fromEntries(formData.entries())
  const repository = await updateRepository(params.repositoryId, entries)
  if (repository) {
    return redirect(`/admin/${params.companyId}`)
  }
  return null
}

const EditRepositoryModal = () => {
  const repository = useLoaderData<typeof loader>()
  if (!repository) {
    return <div>repository not found</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Repository</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" id="repository-edit-form">
          <div className="grid grid-cols-[auto_1fr] items-center gap-4">
            <div className="col-span-2">
              <AppProviderBadge provider={repository.integration.provider} />
            </div>

            {match(repository.integration.provider)
              .with('github', () => (
                <>
                  <Label htmlFor="owner">Owner</Label>
                  <Input name="owner" id="owner" defaultValue={repository.owner ?? ''} />

                  <Label htmlFor="repo">Repo</Label>
                  <Input name="repo" id="repo" defaultValue={repository.repo ?? ''} />
                </>
              ))
              .with('gitlab', () => (
                <>
                  <Label htmlFor="projectId">ProjectID</Label>
                  <Input name="projectId" id="projectId" autoFocus defaultValue={repository.projectId ?? ''} />
                </>
              ))
              .otherwise(() => (
                <></>
              ))}

            <Label htmlFor="releaseDetectionMethod">Release Detection Method</Label>
            <Input
              name="releaseDetectionMethod"
              id="releaseDetectionMethod"
              defaultValue={repository.releaseDetectionMethod}
            />

            <Label htmlFor="releaseDetectionKey">Release Detection Key</Label>
            <Input name="releaseDetectionKey" id="releaseDetectionKey" defaultValue={repository.releaseDetectionKey} />
          </div>
        </Form>
      </CardContent>
      <CardFooter>
        <Stack direction="row">
          <Button type="submit" form="repository-edit-form">
            Update
          </Button>
          <Button asChild variant="ghost">
            <Link to=".." preventScrollReset>
              Cancel
            </Link>
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
export default EditRepositoryModal
