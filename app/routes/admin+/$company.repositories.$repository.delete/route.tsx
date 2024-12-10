import { getFormProps, useForm } from '@conform-to/react'
import {
  type ActionFunctionArgs,
  Form,
  Link,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { $path } from 'safe-routes'
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

export const action = async ({ params }: ActionFunctionArgs) => {
  const { company: companyId, repository: repositoryId } = zx.parseParams(
    params,
    {
      company: z.string(),
      repository: z.string(),
    },
  )

  await deleteRepository(repositoryId)

  return redirect($path('/admin/:company/repositories', { company: companyId }))
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
            <Link
              to={$path('/admin/:company/repositories', { company: companyId })}
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
