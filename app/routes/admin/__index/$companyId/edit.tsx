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
import { Form, useLoaderData, useNavigate } from '@remix-run/react'
import type { LoaderArgs, ActionArgs } from '@remix-run/server-runtime'
import invariant from 'tiny-invariant'
import { AppLink } from '~/app/components/AppLink'
import { getCompany, updateCompany } from '~/app/models/admin/company.server'
import dayjs from '~/app/libs/dayjs'

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
  if (companyId && name) return await updateCompany(companyId, name.toString())
  else return null
}

const EditCompany = () => {
  const company = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        navigate('..')
      }}
      closeOnEsc
    >
      <ModalOverlay></ModalOverlay>
      <ModalContent>
        <ModalHeader>Edit company</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Form action="." method="post" id="form">
            <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
              <FormLabel>ID</FormLabel>
              <Box py="1"> {company.id}</Box>

              <FormLabel htmlFor="name">Name</FormLabel>
              <Input py="1" name="name" id="name" defaultValue={company.name}></Input>

              <FormLabel>Updated At</FormLabel>
              <Box py="1"> {dayjs(company.updatedAt).fromNow()}</Box>

              <FormLabel>Created At</FormLabel>
              <Box py="1"> {dayjs(company.createdAt).fromNow()}</Box>
            </Box>
          </Form>
        </ModalBody>

        <ModalFooter>
          <Stack direction="row" justify="center">
            <Button type="submit" colorScheme="blue" form="form">
              Update
            </Button>

            <AppLink to="..">
              <Button variant="ghost">Cancel</Button>
            </AppLink>
          </Stack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
export default EditCompany
