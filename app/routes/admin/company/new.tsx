import type { ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { Stack, Heading, Box, FormLabel, Input, Button } from '@chakra-ui/react'
import { createCompany } from '~/app/models/admin/company.server'

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData()
  const name = formData.get('name')?.toString()
  if (!name) {
    return null
  }

  const company = await createCompany(name)
  console.log(company)
  if (company) {
    return redirect(`/admin/company/${company.id}`)
  }
  return company
}

const CompanyNewPage = () => {
  return (
    <Box bgColor="white" boxShadow="md" rounded="md" p="4">
      <Form action="." method="post">
        <Stack>
          <Heading fontSize="md">Create a new company</Heading>
          <Box display="grid" gridTemplateColumns="auto 1fr" alignItems="baseline">
            <FormLabel htmlFor="name">Name</FormLabel>
            <Input id="name" name="name"></Input>
          </Box>
          <Button type="submit" colorScheme="blue">
            Create
          </Button>
        </Stack>
      </Form>
    </Box>
  )
}
export default CompanyNewPage
