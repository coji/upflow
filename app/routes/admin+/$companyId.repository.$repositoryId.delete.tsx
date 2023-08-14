import { useForm } from '@conform-to/react'
import { json, redirect, type ActionArgs, type LoaderArgs } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, HStack, Input, Label } from '~/app/components/ui'
import { deleteRepository, getRepository } from '~/app/models/admin/repository.server'

export const handle = { breadcrumb: () => ({ label: 'Delete Repository' }) }

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, { companyId: z.string(), repositoryId: z.string() })
  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  if (!repository.integration) {
    throw new Error('repository.integration not found')
  }
  return json({ companyId, repositoryId, repository })
}

export const action = async ({ params }: ActionArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, { companyId: z.string(), repositoryId: z.string() })
  await deleteRepository(repositoryId)
  return redirect(`/admin/${companyId}/repository`)
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
        <Form method="POST" {...form.props}>
          <Label>Name</Label>
          <Input readOnly disabled defaultValue={repository.name} />
        </Form>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button variant="destructive" type="submit" form={form.id}>
            Delete
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/admin/${companyId}/repository`}>Cancel</Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
export default AddRepositoryModal
