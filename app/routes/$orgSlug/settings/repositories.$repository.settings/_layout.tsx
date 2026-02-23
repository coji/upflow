import { zx } from '@coji/zodix/v4'
import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, Link, data, redirect } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
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
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from './+types/_layout'
import {
  getIntegration,
  getRepository,
  updateRepository,
} from './functions.server'

export const handle = { breadcrumb: () => ({ label: 'Edit' }) }

const githubSchema = z.object({
  provider: z.literal('github'),
  owner: z.string().min(1),
  repo: z.string().min(1),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string().min(1),
})

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(repositoryId)
  if (!repository || repository.organizationId !== organization.id) {
    throw new Response('repository not found', { status: 404 })
  }
  const integration = await getIntegration(organization.id)
  if (!integration) {
    throw new Error('Organization integration not found')
  }

  return {
    organization,
    repositoryId,
    repository,
    provider: integration.provider,
  }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(repositoryId)
  if (!repository || repository.organizationId !== organization.id) {
    throw new Response('repository not found', { status: 404 })
  }
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: githubSchema })
  if (submission.status !== 'success') {
    return data(submission.reply(), { status: 400 })
  }

  await updateRepository(repositoryId, submission.value)

  return redirect(`/${organization.slug}/settings/repositories`)
}

const GithubRepositoryForm = ({
  repository,
}: {
  repository: NonNullable<Awaited<ReturnType<typeof getRepository>>>
}) => {
  const [form, { owner, repo, releaseDetectionKey, releaseDetectionMethod }] =
    useForm({
      id: 'repository-edit-form',
      onValidate: ({ formData }) =>
        parseWithZod(formData, { schema: githubSchema }),
      defaultValue: repository,
    })

  return (
    <Form method="POST" {...getFormProps(form)}>
      <Stack>
        <fieldset>
          <AppProviderBadge provider="github" />
          <input type="hidden" name="provider" value="github" />
        </fieldset>

        <fieldset>
          <Label htmlFor={owner.id}>Owner</Label>
          <Input {...getInputProps(owner, { type: 'text' })} />
          <div className="text-destructive">{owner.errors}</div>
        </fieldset>

        <fieldset>
          <Label htmlFor={repo.id}>Repo</Label>
          <Input {...getInputProps(repo, { type: 'text' })} />
          <div className="text-destructive">{repo.errors}</div>
        </fieldset>

        <fieldset>
          <Label htmlFor={releaseDetectionMethod.id}>
            Release Detection Method
          </Label>
          <Select
            name={releaseDetectionMethod.name}
            defaultValue={releaseDetectionMethod.initialValue}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a method" />
            </SelectTrigger>
            <SelectContent {...getSelectProps(releaseDetectionMethod)}>
              <SelectGroup>
                <SelectItem value="branch">Branch</SelectItem>
                <SelectItem value="tags">Tags</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="text-destructive">
            {releaseDetectionMethod.errors}
          </div>
        </fieldset>

        <fieldset>
          <Label htmlFor={releaseDetectionKey.id}>Release Detection Key</Label>
          <Input {...getInputProps(releaseDetectionKey, { type: 'text' })} />
          <div className="text-destructive">{releaseDetectionKey.errors}</div>
        </fieldset>
      </Stack>
    </Form>
  )
}

export default function EditRepositoryModal({
  loaderData: { organization, repository, provider },
}: Route.ComponentProps) {
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
            <Link to={`/${organization.slug}/settings/repositories`}>
              Cancel
            </Link>
          </Button>
        </Stack>
      </CardFooter>
    </Card>
  )
}
