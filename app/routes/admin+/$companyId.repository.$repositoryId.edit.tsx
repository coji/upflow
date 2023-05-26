import { Box, Button, FormLabel, GridItem, Stack, Input } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { AppLink, AppMutationModal, AppProviderBadge } from '~/app/components'
import { updateRepository, getRepository } from '~/app/models/admin/repository.server'
import { match } from 'ts-pattern'

export const loader = async ({ request, params }: LoaderArgs) => {
  invariant(params.repositoryId, 'company id should specified')
  const repository = getRepository(params.repositoryId)
  if (!repository) {
    throw new Error('repository not found')
  }
  return repository
}

export const action = async ({ request, params }: ActionArgs) => {
  const formData = await request.formData()
  invariant(params.repositoryId, 'repository id should specified')
  const entries = Object.fromEntries(formData.entries())
  const repository = await updateRepository(params.repositoryId, entries)
  if (repository) {
    return redirect(`/admin/${params.companyId}`)
  }
  return null
}

const EditRepositoryModal = () => {
  const repository = useLoaderData<typeof loader>()
  if (!repository) {
    return <Box>repository not found</Box>
  }

  return (
    <AppMutationModal
      title="Remove repository"
      footer={
        <Stack direction="row">
          <Button colorScheme="blue" type="submit" form="form">
            Update
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
            <AppProviderBadge provider={repository.integration.provider} />
          </GridItem>

          {match(repository.integration.provider)
            .with('github', () => (
              <>
                <FormLabel m="0" htmlFor="owner">
                  Owner
                </FormLabel>
                <Input name="owner" id="owner" defaultValue={repository.owner ?? ''} />

                <FormLabel m="0" htmlFor="repo">
                  Repo
                </FormLabel>
                <Input name="repo" id="repo" defaultValue={repository.repo ?? ''} />
              </>
            ))
            .with('gitlab', () => (
              <>
                <FormLabel m="0" htmlFor="projectId">
                  ProjectID
                </FormLabel>
                <Input name="projectId" id="projectId" autoFocus defaultValue={repository.projectId ?? ''} />
              </>
            ))
            .otherwise(() => (
              <></>
            ))}

          <FormLabel m="0" htmlFor="releaseDetectionMethod">
            Release Detection Method
          </FormLabel>
          <Input
            name="releaseDetectionMethod"
            id="releaseDetectionMethod"
            defaultValue={repository.releaseDetectionMethod}
          />

          <FormLabel m="0" htmlFor="releaseDetectionKey">
            Release Detection Key
          </FormLabel>
          <Input name="releaseDetectionKey" id="releaseDetectionKey" defaultValue={repository.releaseDetectionKey} />
        </Box>
      </Form>
    </AppMutationModal>
  )
}
export default EditRepositoryModal
