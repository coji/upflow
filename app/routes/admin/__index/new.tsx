import {
  Box,
  Button,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack
} from '@chakra-ui/react'
import type { ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useNavigate } from '@remix-run/react'
import { createCompany } from '~/app/models/admin/company.server'

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
  const navigate = useNavigate()

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        navigate('..')
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
