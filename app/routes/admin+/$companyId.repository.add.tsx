import { Box, Button, FormLabel, GridItem, Input, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { match } from 'ts-pattern'
import { zfd } from 'zod-form-data'
import { AppLink, AppMutationModal, AppProviderBadge } from '~/app/components'
import { getIntegration } from '~/app/models/admin/integration.server'
import { createRepository } from '~/app/models/admin/repository.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  invariant(params.companyId, 'company id should specified')
  const integration = getIntegration(params.companyId)
  if (!integration) {
    throw new Error('integration not created')
  }
  return integration
}

const providerSchema = zfd.formData({
  projectId: zfd.text().optional(),
  owner: zfd.text().optional(),
  repo: zfd.text().optional(),
})
export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.companyId, 'company id should specified')
  const integration = getIntegration(params.companyId)
  if (!integration) {
    throw new Error('integration not created')
  }
  const formData = await request.formData()
  const { projectId, owner, repo } = providerSchema.parse(formData)
  const repository = await createRepository({ companyId: params.companyId, projectId, owner, repo })
  if (repository) {
    return redirect(`/admin/${params.companyId}`)
  } else {
    return null
  }
}

const AddRepositoryModal = () => {
  const integration = useLoaderData<typeof loader>()
  if (!integration) {
    return <Box>integration not found</Box>
  }

  return (
    <AppMutationModal
      title="Add a repository"
      footer={
        <Stack direction="row">
          <Button colorScheme="blue" type="submit" form="form">
            Add
          </Button>
          <Button as={AppLink} to=".." variant="ghost">
            Cancel
          </Button>
        </Stack>
      }
    >
      <Form method="post" id="form">
        <Box display="grid" gridTemplateColumns="auto 1fr" gap="4" alignItems="center">
          <GridItem colSpan={2}>
            <AppProviderBadge provider={integration.provider} />
          </GridItem>

          {match(integration.provider)
            .with('github', () => (
              <>
                <FormLabel m="0" htmlFor="owner">
                  Owner
                </FormLabel>
                <Input name="owner" id="owner" autoFocus />

                <FormLabel m="0" htmlFor="repo">
                  Repo
                </FormLabel>
                <Input name="repo" id="repo" />
              </>
            ))
            .with('gitlab', () => (
              <>
                <FormLabel m="0" htmlFor="projectId">
                  ProjectID
                </FormLabel>
                <Input name="projectId" id="projectId" autoFocus />
              </>
            ))
            .otherwise(() => (
              <></>
            ))}
        </Box>
      </Form>
    </AppMutationModal>
  )
}
export default AddRepositoryModal