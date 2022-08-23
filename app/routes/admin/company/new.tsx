import type { ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useNavigate } from '@remix-run/react'
import {
  Stack,
  Box,
  FormLabel,
  Input,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter
} from '@chakra-ui/react'
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
  const navigate = useNavigate()

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        navigate('/admin/company')
      }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create new company</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Form action="." method="post" id="new-form" autoComplete="false">
            <Stack>
              <Box display="grid" gridTemplateColumns="auto 1fr" alignItems="baseline">
                <FormLabel htmlFor="name">Name</FormLabel>
                <Input id="name" name="name" autoFocus></Input>
              </Box>
            </Stack>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button type="submit" colorScheme="blue" form="new-form">
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
export default CompanyNewPage
