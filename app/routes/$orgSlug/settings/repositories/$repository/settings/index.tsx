import { zx } from '@coji/zodix/v4'
import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import {
  Form,
  Link,
  data,
  href,
  redirect,
  useActionData,
  useFetcher,
  useNavigation,
} from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { AppProviderBadge } from '~/app/components'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
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
import { getErrorMessage } from '~/app/libs/error-message'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../../../+components/content-section'
import { getRepository } from '../queries.server'
import {
  deleteRepository,
  updateRepository,
} from './+functions/mutations.server'
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

const updateRepoSchema = githubSchema.extend({
  intent: z.literal('update'),
})

const confirmDeleteRepoSchema = z.object({
  intent: z.literal('confirm-delete'),
})

const deleteRepoSchema = z.object({
  intent: z.literal('delete'),
})

const actionSchema = z.discriminatedUnion('intent', [
  updateRepoSchema,
  confirmDeleteRepoSchema,
  deleteRepoSchema,
])

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
  const submission = parseWithZod(formData, { schema: actionSchema })
  if (submission.status !== 'success') {
    return data({ lastResult: submission.reply() }, { status: 400 })
  }

  return match(submission.value)
    .with(
      { intent: 'update' },
      async ({ intent: _intent, provider: _provider, ...values }) => {
        try {
          await updateRepository(organization.id, repositoryId, values)
        } catch (e) {
          return data(
            {
              lastResult: submission.reply({
                formErrors: [getErrorMessage(e)],
              }),
            },
            { status: 400 },
          )
        }
        return redirect(
          href('/:orgSlug/settings/repositories', {
            orgSlug: organization.slug,
          }),
        )
      },
    )
    .with({ intent: 'confirm-delete' }, () => {
      return data({ shouldConfirm: true })
    })
    .with({ intent: 'delete' }, async () => {
      try {
        await deleteRepository(organization.id, repositoryId)
      } catch (e) {
        return data(
          {
            lastResult: submission.reply({ formErrors: [getErrorMessage(e)] }),
            shouldConfirm: true,
          },
          { status: 400 },
        )
      }
      return redirect(
        href('/:orgSlug/settings/repositories', {
          orgSlug: organization.slug,
        }),
      )
    })
    .exhaustive()
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
  const actionData = useActionData<typeof action>()
  const [form, { owner, repo, releaseDetectionKey, releaseDetectionMethod }] =
    useForm({
      id: 'repository-edit-form',
      lastResult:
        actionData && 'lastResult' in actionData
          ? actionData.lastResult
          : undefined,
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
          <input type="hidden" name="intent" value="update" />
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
            <SelectTrigger className="w-full">
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

        {form.errors && form.errors.length > 0 && (
          <p className="text-destructive text-sm">{form.errors.join(', ')}</p>
        )}
        <Stack direction="row">
          <Button type="submit" loading={isSubmitting}>
            Update
          </Button>
          <Button asChild variant="ghost">
            <Link
              to={href('/:orgSlug/settings/repositories', {
                orgSlug: organization.slug,
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

function DangerZone({
  repository,
}: {
  repository: { owner: string; repo: string }
}) {
  const deleteFetcher = useFetcher()

  return (
    <ContentSection
      title="Danger Zone"
      desc="Irreversible actions for this repository."
    >
      <Button
        variant="destructive"
        onClick={() => {
          deleteFetcher.submit({ intent: 'confirm-delete' }, { method: 'post' })
        }}
      >
        Delete Repository
      </Button>
      <ConfirmDialog
        title="Delete Repository"
        desc={`Are you sure you want to delete ${repository.owner}/${repository.repo}? This action cannot be undone.`}
        confirmText="Delete"
        destructive
        fetcher={deleteFetcher}
      >
        <input type="hidden" name="intent" value="delete" />
      </ConfirmDialog>
    </ContentSection>
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
    <Stack gap="6">
      <ContentSection
        title="Edit Repository"
        desc="Update repository settings."
      >
        {form}
      </ContentSection>

      <DangerZone repository={repository} />
    </Stack>
  )
}
