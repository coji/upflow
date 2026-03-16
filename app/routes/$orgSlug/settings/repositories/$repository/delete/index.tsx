import { zx } from '@coji/zodix/v4'
import { getFormProps, useForm } from '@conform-to/react'
import { Form, Link, href, redirect, useNavigation } from 'react-router'
import { z } from 'zod'
import { Button, HStack, Input, Label, Stack } from '~/app/components/ui'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../../../+components/content-section'
import { getRepository } from '../queries.server'
import { deleteRepository } from './+functions/mutations.server'
import type { Route } from './+types/index'

export const handle = { breadcrumb: () => ({ label: 'Delete' }) }

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(organization.id, repositoryId)
  if (!repository) {
    throw new Response('repository not found', { status: 404 })
  }
  return { organization, repositoryId, repository }
}

export const action = async ({ params, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(organization.id, repositoryId)
  if (!repository) {
    throw new Response('repository not found', { status: 404 })
  }

  await deleteRepository(organization.id, repositoryId)

  return redirect(
    href('/:orgSlug/settings/repositories', { orgSlug: organization.slug }),
  )
}

export default function DeleteRepositoryPage({
  loaderData: { organization, repository },
}: Route.ComponentProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const [form] = useForm({ id: 'delete-repository-form' })

  return (
    <ContentSection
      title="Delete Repository"
      desc="This action cannot be undone."
    >
      <Stack>
        <Form method="POST" {...getFormProps(form)}>
          <fieldset className="space-y-1">
            <Label>Name</Label>
            <Input
              readOnly
              disabled
              defaultValue={`${repository.owner}/${repository.repo}`}
            />
          </fieldset>
        </Form>

        <HStack>
          <Button
            variant="destructive"
            type="submit"
            form={form.id}
            loading={isSubmitting}
          >
            Delete
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
        </HStack>
      </Stack>
    </ContentSection>
  )
}
