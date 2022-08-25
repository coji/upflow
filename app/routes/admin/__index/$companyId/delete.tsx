import { Box, Button, FormLabel, Input, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import invariant from 'tiny-invariant'
import { AppLink } from '~/app/components/AppLink'
import dayjs from '~/app/libs/dayjs'
import { deleteCompany, getCompany } from '~/app/models/admin/company.server'
import { AppMutationModal } from '~/app/components/AppMutationModal'

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.companyId, 'companyId shout specified')
  const company = await getCompany(params.companyId)
  if (!company) {
    throw new Response('No company', { status: 404 })
  }
  return company
}

export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.companyId, 'companyId shoud specified')
  const company = await deleteCompany(params.companyId)
  if (company) {
    return redirect('/admin')
  }
  return null
}

const CompanyDelete = () => {
  const company = useLoaderData<typeof loader>()
  const [isEnabled, setIsEnabled] = useState(false)

  return (
    <AppMutationModal
      title="Delete a company"
      footer={
        <Stack direction="row" justify="center">
          <Button type="submit" colorScheme="red" disabled={!isEnabled} form="form">
            DELETE
          </Button>

          <AppLink to="..">
            <Button variant="ghost">Cancel</Button>
          </AppLink>
        </Stack>
      }
    >
      <Stack>
        <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
          <FormLabel>ID</FormLabel>
          <Box py="1"> {company.id}</Box>

          <FormLabel>Name</FormLabel>
          <Box py="1"> {company.name}</Box>

          <FormLabel>Updated At</FormLabel>
          <Box py="1"> {dayjs(company.updatedAt).fromNow()}</Box>

          <FormLabel>Created At</FormLabel>
          <Box py="1"> {dayjs(company.createdAt).fromNow()}</Box>
        </Box>

        <Form action="." method="post" id="form">
          <FormLabel htmlFor="confirm">Confirm</FormLabel>
          <Input
            id="confirm"
            onChange={(event) => {
              setIsEnabled(event.target.value === 'delete this company')
            }}
            placeholder="type 'delete this company' here"
          ></Input>
        </Form>
      </Stack>
    </AppMutationModal>
  )
}
export default CompanyDelete
