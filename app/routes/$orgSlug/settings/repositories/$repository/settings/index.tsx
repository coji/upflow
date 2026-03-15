import { zx } from '@coji/zodix/v4'
import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form, Link, data, href, redirect, useNavigation } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { AppProviderBadge } from '~/app/components'
import {
  Button,
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
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../../../+components/content-section'
import { getRepository } from '../queries.server'
import { updateRepository } from './+functions/mutations.server'
import { getIntegration } from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = { breadcrumb: () => ({ label: 'Edit' }) }

const githubSchema = z.object({
  provider: z.literal('github'),
  owner: z.string().min(1),
  repo: z.string().min(1),
  releaseDetectionMethod: z.enum(['branch', 'tags']),
  releaseDetectionKey: z.string().min(1),
})

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(organization.id, repositoryId)
  if (!repository) {
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

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(organization.id, repositoryId)
  if (!repository) {
    throw new Response('repository not found', { status: 404 })
  }
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: githubSchema })
  if (submission.status !== 'success') {
    return data(submission.reply(), { status: 400 })
  }

  await updateRepository(organization.id, repositoryId, submission.value)

  return redirect(
    href('/:orgSlug/settings/repositories', { orgSlug: organization.slug! }),
  )
}

const GithubRepositoryForm = ({
  organization,
  repository,
}: {
  organization: { slug: string }
  repository: NonNullable<Awaited<ReturnType<typeof getRepository>>>
}) => {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
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
        <fieldset className="space-y-1">
          <AppProviderBadge provider="github" />
          <input type="hidden" name="provider" value="github" />
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={owner.id}>Owner</Label>
          <Input {...getInputProps(owner, { type: 'text' })} />
          <div className="text-destructive">{owner.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
          <Label htmlFor={repo.id}>Repo</Label>
          <Input {...getInputProps(repo, { type: 'text' })} />
          <div className="text-destructive">{repo.errors}</div>
        </fieldset>

        <fieldset className="space-y-1">
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

        <fieldset className="space-y-1">
          <Label htmlFor={releaseDetectionKey.id}>Release Detection Key</Label>
          <Input {...getInputProps(releaseDetectionKey, { type: 'text' })} />
          <div className="text-destructive">{releaseDetectionKey.errors}</div>
        </fieldset>

        <Stack direction="row">
          <Button type="submit" loading={isSubmitting}>
            Update
          </Button>
          <Button asChild variant="ghost">
            <Link
              to={href('/:orgSlug/settings/repositories', {
                orgSlug: organization.slug!,
              })}
            >
              Cancel
            </Link>
          </Button>
        </Stack>
      </Stack>
    </Form>
  )
}

export default function EditRepositoryPage({
  loaderData: { organization, repository, provider },
}: Route.ComponentProps) {
  const form = match(provider)
    .with('github', () => (
      <GithubRepositoryForm
        organization={organization}
        repository={repository}
      />
    ))
    .otherwise(() => <></>)

  return (
    <ContentSection title="Edit Repository" desc="Update repository settings.">
      {form}
    </ContentSection>
  )
}
