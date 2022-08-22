import type { LoaderArgs, ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { getCompany, deleteCompany } from '~/app/models/admin/company.server'
import invariant from 'tiny-invariant'
import { Heading, Stack, Input, Box, Button, FormLabel } from '@chakra-ui/react'
import { useState } from 'react'

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.companyId, 'companyId shout specified')
  return {
    company: await getCompany(params.companyId)
  }
}

export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.companyId, 'companyId shoud specified')
  const company = await deleteCompany(params.companyId)
  if (company) {
    return redirect(`/admin`)
  }
  return null
}

const CompanyDelete = () => {
  const { company } = useLoaderData<typeof loader>()
  const [isEnabled, setIsEnabled] = useState(false)

  return (
    <Box bgColor="white" rounded="md" boxShadow="md" p="4">
      <Form action="." method="post">
        <Stack>
          <Heading size="md">Are you shure delete this company?</Heading>

          <Box display="grid" gridTemplateColumns="auto 1fr">
            <FormLabel>ID</FormLabel>
            <Box> {company.id}</Box>

            <FormLabel>Name</FormLabel>
            <Box> {company.name}</Box>

            <FormLabel>Updated At</FormLabel>
            <Box> {company.updatedAt}</Box>

            <FormLabel>Created At</FormLabel>
            <Box> {company.createdAt}</Box>
          </Box>

          <Box>
            <FormLabel htmlFor="confirm">Type Confirm</FormLabel>
            <Input
              id="confirm"
              onChange={(event) => {
                setIsEnabled(event.target.value === 'delete this company')
              }}
              placeholder="type 'delete this company' here"
            ></Input>
          </Box>

          <Button type="submit" colorScheme="red" disabled={!isEnabled}>
            DELETE
          </Button>
        </Stack>
      </Form>
    </Box>
  )
}
export default CompanyDelete
