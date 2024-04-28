import { getFormProps, useForm } from '@conform-to/react'
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
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
import { deleteRepository, getRepository } from './functions.server'

export const handle = { breadcrumb: () => ({ label: 'Delete' }) }

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, {
    companyId: z.string(),
    repositoryId: z.string(),
  })
  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  return { companyId, repositoryId, repository }
}

export const action = async ({ params }: ActionFunctionArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, {
    companyId: z.string(),
    repositoryId: z.string(),
  })

  await deleteRepository(repositoryId)

  return redirect($path('/admin/:companyId/repositories', { companyId }))
}

const AddRepositoryModal = () => {
  const { companyId, repository } = useLoaderData<typeof loader>()
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
            <Link to={$path('/admin/:companyId/repositories', { companyId })}>
              Cancel
            </Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default AddRepositoryModal
