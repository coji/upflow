import type { LoaderArgs, ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData, Link } from '@remix-run/react'
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
          <Heading size="md">Are you sure delete this company?</Heading>

          <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
            <FormLabel>ID</FormLabel>
            <Box py="1"> {company.id}</Box>

            <FormLabel>Name</FormLabel>
            <Box py="1"> {company.name}</Box>

            <FormLabel>Updated At</FormLabel>
            <Box py="1"> {company.updatedAt}</Box>

            <FormLabel>Created At</FormLabel>
            <Box py="1"> {company.createdAt}</Box>
          </Box>

          <FormLabel htmlFor="confirm">Confirm</FormLabel>
          <Input
            id="confirm"
            onChange={(event) => {
              setIsEnabled(event.target.value === 'delete this company')
            }}
            placeholder="type 'delete this company' here"
          ></Input>

          <Stack direction="row" justify="center">
            <Button type="submit" colorScheme="red" disabled={!isEnabled}>
              DELETE
            </Button>

            <Link to={`/admin/company/${company.id}`}>
              <Button as="span" variant="ghost">
                Cancel
              </Button>
            </Link>
          </Stack>
        </Stack>
      </Form>
    </Box>
  )
}
export default CompanyDelete
