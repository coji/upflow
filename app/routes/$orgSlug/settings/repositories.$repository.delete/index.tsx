import { zx } from '@coji/zodix/v4'
import { getFormProps, useForm } from '@conform-to/react'
import { Form, Link, redirect } from 'react-router'
import { z } from 'zod'
import { Button, HStack, Input, Label, Stack } from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'
import { deleteRepository, getRepository } from './functions.server'

export const handle = { breadcrumb: () => ({ label: 'Delete' }) }

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(organization.id, repositoryId)
  if (!repository) {
    throw new Response('repository not found', { status: 404 })
  }
  return { organization, repositoryId, repository }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })
  const repository = await getRepository(organization.id, repositoryId)
  if (!repository) {
    throw new Response('repository not found', { status: 404 })
  }

  await deleteRepository(organization.id, repositoryId)

  return redirect(`/${organization.slug}/settings/repositories`)
}

export default function DeleteRepositoryPage({
  loaderData: { organization, repository },
}: Route.ComponentProps) {
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
          <Button variant="destructive" type="submit" form={form.id}>
            Delete
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/${organization.slug}/settings/repositories`}>
              Cancel
            </Link>
          </Button>
        </HStack>
      </Stack>
    </ContentSection>
  )
}
