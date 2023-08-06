import { Box, Button, FormLabel, GridItem, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { AppLink, AppMutationModal, AppProviderBadge } from '~/app/components'
import { deleteRepository, getRepository } from '~/app/models/admin/repository.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  invariant(params.repositoryId, 'company id should specified')
  const repository = getRepository(params.repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  return repository
}

export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.repositoryId, 'repository id should specified')
  const repository = await deleteRepository(params.repositoryId)
  if (repository) {
    return redirect(`/admin/${params.companyId}`)
  }
  return null
}

const AddRepositoryModal = () => {
  const repository = useLoaderData<typeof loader>()
  if (!repository) {
    return <Box>repository not found</Box>
  }

  return (
    <AppMutationModal
      title="Remove repository"
      footer={
        <Stack direction="row">
          <Button colorScheme="red" type="submit" form="form">
            Delete
          </Button>
          <AppLink to="..">
            <Button variant="ghost">Cancel</Button>
          </AppLink>
        </Stack>
      }
    >
      <Form method="post" id="form">
        <Box display="grid" gridTemplateColumns="auto 1fr" gap="4" alignItems="center">
          <GridItem colSpan={2}>
            <AppProviderBadge provider={repository.provider} />
          </GridItem>
          <FormLabel>Name</FormLabel>
          <Box>{repository.name}</Box>
        </Box>
      </Form>
    </AppMutationModal>
  )
}
export default AddRepositoryModal