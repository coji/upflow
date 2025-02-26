import { getFormProps, useForm } from '@conform-to/react'
import { Form, href, Link, redirect } from 'react-router'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  HStack,
  Input,
  Label,
} from '~/app/components/ui'
import type { Route } from './+types/route'
import { deleteRepository, getRepository } from './functions.server'

export const handle = { breadcrumb: () => ({ label: 'Delete' }) }

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId, repository: repositoryId } = zx.parseParams(
    params,
    {
      company: z.string(),
      repository: z.string(),
    },
  )
  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  return { companyId, repositoryId, repository }
}

export const action = async ({ params }: Route.ActionArgs) => {
  const { company: companyId, repository: repositoryId } = zx.parseParams(
    params,
    {
      company: z.string(),
      repository: z.string(),
    },
  )

  await deleteRepository(repositoryId)

  return redirect(href('/admin/:company/repositories', { company: companyId }))
}

const AddRepositoryModal = ({
  loaderData: { companyId, repository },
}: Route.ComponentProps) => {
  const [form] = useForm({ id: 'delete-repository-form' })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete repository</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="POST" {...getFormProps(form)}>
          <Label>Name</Label>
          <Input
            readOnly
            disabled
            defaultValue={`${repository.owner}/${repository.repo}`}
          />
        </Form>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button variant="destructive" type="submit" form={form.id}>
            Delete
          </Button>
          <Button asChild variant="ghost">
            <Link
              to={href('/admin/:company/repositories', { company: companyId })}
            >
              Cancel
            </Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default AddRepositoryModal
