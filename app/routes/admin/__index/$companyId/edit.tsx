import { Box, Button, FormLabel, Input, Select, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { AppLink, AppMutationModal } from '~/app/components'
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
  const releaseDetectionMethod = formData.get('releaseDetectionMethod')
  const releaseDetectionKey = formData.get('releaseDetectionKey')
  if (companyId && name) {
    const company = await updateCompany({
      companyId,
      name: String(name),
      releaseDetectionMethod: String(releaseDetectionMethod),
      releaseDetectionKey: String(releaseDetectionKey)
    })
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

          <FormLabel htmlFor="releaseDetectionMethod">Release Detection Method</FormLabel>
          <Select
            py="1"
            name="releaseDetectionMethod"
            id="releaseDetectionMethod"
            autoFocus
            defaultValue={company.releaseDetectionMethod}
          >
            <option value="tags">tags</option>
            <option value="branch">branch</option>
          </Select>

          <FormLabel htmlFor="releaseDetectionKey">Release Detection Key</FormLabel>
          <Input
            py="1"
            name="releaseDetectionKey"
            id="releaseDetectionKey"
            autoFocus
            defaultValue={company.releaseDetectionKey}
          ></Input>

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
