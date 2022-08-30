import { Box, Button, FormLabel, Input, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { AppLink } from '~/app/components/AppLink'
import { AppMutationModal } from '~/app/components/AppMutationModal'
import dayjs from '~/app/libs/dayjs'
import { getCompany, updateCompany } from '~/app/models/admin/company.server'

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.companyId, 'companyId shout specified')
  const company = await getCompany(params.companyId)
  if (!company) {
    throw new Response('No company', { status: 404 })
  }
  return company
}

export const action = async ({ request, params }: ActionArgs) => {
  const { companyId } = params
  const formData = await request.formData()
  const name = formData.get('name')
  if (companyId && name) {
    const company = await updateCompany(companyId, name.toString())
    return redirect(`/admin/${company.id}`)
  } else return null
}

const EditCompany = () => {
  const company = useLoaderData<typeof loader>()

  return (
    <AppMutationModal
      title="Edit company"
      footer={
        <Stack direction="row" justify="center">
          <Button type="submit" colorScheme="blue" form="form">
            Update
          </Button>

          <AppLink to="..">
            <Button variant="ghost">Cancel</Button>
          </AppLink>
        </Stack>
      }
    >
      <Form method="post" id="form">
        <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
          <FormLabel>ID</FormLabel>
          <Box py="1"> {company.id}</Box>

          <FormLabel htmlFor="name">Name</FormLabel>
          <Input py="1" name="name" id="name" autoFocus defaultValue={company.name}></Input>

          <FormLabel>Updated At</FormLabel>
          <Box py="1"> {dayjs(company.updatedAt).fromNow()}</Box>

          <FormLabel>Created At</FormLabel>
          <Box py="1"> {dayjs(company.createdAt).fromNow()}</Box>
        </Box>
      </Form>
    </AppMutationModal>
  )
}
export default EditCompany
