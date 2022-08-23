import type { LoaderArgs, ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData, useNavigate } from '@remix-run/react'
import { getCompany, deleteCompany } from '~/app/models/admin/company.server'
import invariant from 'tiny-invariant'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Stack,
  Input,
  Box,
  Button,
  FormLabel
} from '@chakra-ui/react'
import { useState } from 'react'
import dayjs from '~/app/libs/dayjs'
import { AppLink } from '~/app/components/AppLink'

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
    return redirect(`/admin/company`)
  }
  return null
}

const CompanyDelete = () => {
  const company = useLoaderData<typeof loader>()
  const [isEnabled, setIsEnabled] = useState(false)
  const navigate = useNavigate()

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        navigate(`/admin/company/${company.id}`)
      }}
      closeOnEsc
    >
      <ModalOverlay></ModalOverlay>
      <ModalContent>
        <ModalHeader>Delete a company</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
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
        </ModalBody>

        <ModalFooter>
          <Stack direction="row" justify="center">
            <Button type="submit" colorScheme="red" disabled={!isEnabled} form="form">
              DELETE
            </Button>

            <Button as={AppLink} to={`/admin/company/${company.id}`} variant="ghost">
              Cancel
            </Button>
          </Stack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
export default CompanyDelete
