import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { json, redirect, type ActionArgs, type LoaderArgs } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppProviderBadge } from '~/app/components'
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, Stack } from '~/app/components/ui'
import { getRepository, updateRepository } from '~/app/models/admin/repository.server'

const githubSchema = z.object({
  provider: z.literal('github'),
  owner: z.string().nonempty(),
  repo: z.string().nonempty(),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string().nonempty(),
})

const gitlabSchema = z.object({
  provider: z.literal('gitlab'),
  projectId: z.string().nonempty(),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string().nonempty(),
})

export const loader = async ({ request, params }: LoaderArgs) => {
  const { repositoryId } = zx.parseParams(params, { companyId: z.string(), repositoryId: z.string() })
  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  if (!repository.integration) {
    throw new Error('repository.integration not found')
  }
  return json({ repository, provider: repository.integration.provider })
}

export const action = async ({ request, params }: ActionArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, { companyId: z.string(), repositoryId: z.string() })
  const formData = await request.formData()
  const entries = Object.fromEntries(formData.entries())
  await updateRepository(repositoryId, entries)
  return redirect(`/admin/${companyId}`)
}

const GithubRepositoryForm = ({
  repository,
}: {
  repository: NonNullable<Awaited<ReturnType<typeof getRepository>>>
}) => {
  const [form, { owner, repo, releaseDetectionKey, releaseDetectionMethod }] = useForm({
    id: 'repository-edit-form',
    onValidate: ({ formData }) => parse(formData, { schema: githubSchema }),
    defaultValue: repository,
  })

  return (
    <Form method="POST" {...form.props}>
      <Stack>
        <fieldset>
          <AppProviderBadge provider="github" />
          <input type="hidden" name="provider" value="github" />
        </fieldset>

        <fieldset>
          <Label htmlFor={owner.id}>Owner</Label>
          <Input {...conform.input(owner)} />
          <div className="text-destructive">{owner.error}</div>
        </fieldset>

        <fieldset>
          <Label htmlFor={repo.id}>Repo</Label>
          <Input {...conform.input(repo)} />
          <div className="text-destructive">{repo.error}</div>
        </fieldset>

        <fieldset>
          <Label htmlFor={releaseDetectionMethod.id}>Release Detection Method</Label>
          <Input {...conform.input(releaseDetectionMethod)} />
          <div className="text-destructive">{releaseDetectionMethod.error}</div>
        </fieldset>

        <fieldset>
          <Label htmlFor={releaseDetectionKey.id}>Release Detection Key</Label>
          <Input {...conform.input(releaseDetectionKey)} />
          <div className="text-destructive">{releaseDetectionKey.error}</div>
        </fieldset>
      </Stack>
    </Form>
  )
}

const GitLabRepositoryForm = ({
  repository,
}: {
  repository: NonNullable<Awaited<ReturnType<typeof getRepository>>>
}) => {
  const [form, { projectId, releaseDetectionKey, releaseDetectionMethod }] = useForm({
    id: 'repository-edit-form',
    onValidate: ({ formData }) => parse(formData, { schema: gitlabSchema }),
    defaultValue: repository,
  })

  return (
    <Form method="POST" {...form.props}>
      <Stack>
        <fieldset>
          <AppProviderBadge provider="gitlab" />
          <input type="hidden" name="provider" value="gitlab" />
        </fieldset>

        <fieldset>
          <Label htmlFor={projectId.id}>ProjectID</Label>
          <Input {...conform.input(projectId)} />
          <div className="text-destructive">{projectId.error}</div>
        </fieldset>

        <fieldset>
          <Label htmlFor="releaseDetectionMethod">Release Detection Method</Label>
          <Input {...conform.input(releaseDetectionMethod)} />
          <div className="text-destructive">{releaseDetectionMethod.error}</div>
        </fieldset>

        <fieldset>
          <Label htmlFor="releaseDetectionKey">Release Detection Key</Label>
          <Input {...conform.input(releaseDetectionKey)} />
          <div className="text-destructive">{releaseDetectionKey.error}</div>
        </fieldset>
      </Stack>
    </Form>
  )
}

const EditRepositoryModal = () => {
  const { repository, provider } = useLoaderData<typeof loader>()
  const form = match(provider)
    .with('github', () => <GithubRepositoryForm repository={repository} />)
    .with('gitlab', () => <GitLabRepositoryForm repository={repository} />)
    .otherwise(() => <></>)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Repository</CardTitle>
      </CardHeader>
      <CardContent>{form}</CardContent>
      <CardFooter>
        <Stack direction="row">
          <Button type="submit" form="repository-edit-form">
            Update
          </Button>
          <Button asChild variant="ghost">
            <Link to="..">Cancel</Link>
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
export default EditRepositoryModal
