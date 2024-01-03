import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppProviderBadge } from '~/app/components'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
} from '~/app/components/ui'
import { getRepository, updateRepository } from '~/app/models/admin/repository.server'

export const handle = { breadcrumb: () => ({ label: 'Edit Repository' }) }

const githubSchema = z.object({
  provider: z.literal('github'),
  owner: z.string().min(1),
  repo: z.string().min(1),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string().min(1),
})

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, { companyId: z.string(), repositoryId: z.string() })
  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  if (!repository.integration) {
    throw new Error('repository.integration not found')
  }
  return json({ companyId, repositoryId, repository, provider: repository.integration.provider })
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
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
          <Select name={releaseDetectionMethod.name} defaultValue={releaseDetectionMethod.defaultValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select a method"></SelectValue>
            </SelectTrigger>
            <SelectContent {...conform.select(releaseDetectionMethod)}>
              <SelectGroup>
                <SelectItem value="branch">Branch</SelectItem>
                <SelectItem value="tags">Tags</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
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

const EditRepositoryModal = () => {
  const { companyId, repository, provider } = useLoaderData<typeof loader>()
  const form = match(provider)
    .with('github', () => <GithubRepositoryForm repository={repository} />)
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
            <Link to={`/admin/${companyId}/repository`}>Cancel</Link>
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
export default EditRepositoryModal
