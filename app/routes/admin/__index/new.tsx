import { Box, Button, FormLabel, Input, Stack } from '@chakra-ui/react'
import type { ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { createCompany } from '~/app/models/admin/company.server'
import { AppMutationModal } from '~/app/components/AppMutationModal'

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData()
  const name = formData.get('name')?.toString()
  if (!name) {
    return null
  }

  const company = await createCompany(name)
  if (company) {
    return redirect(`/admin/${company.id}`)
  }
  return company
}

const CompanyNewPage = () => {
  return (
    <AppMutationModal
      title="Create a company"
      footer={
        <Button type="submit" colorScheme="blue" form="new-form">
          Create
        </Button>
      }
    >
      <Form method="post" id="new-form" autoComplete="false">
        <Stack>
          <Box display="grid" gridTemplateColumns="auto 1fr" alignItems="baseline">
            <FormLabel htmlFor="name">Name</FormLabel>
            <Input id="name" name="name" autoFocus></Input>
          </Box>
        </Stack>
      </Form>
    </AppMutationModal>
  )
}
export default CompanyNewPage
