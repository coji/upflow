import { Box, Button, Icon, Radio, Stack } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { RiGithubFill, RiGitlabFill } from 'react-icons/ri'
import { ValidatedForm, validationError } from 'remix-validated-form'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import { AppLink, AppMutationModal, AppRadioGroup, AppSubmitButton, AppTextarea } from '~/app/components'
import { createIntegration, getIntegration } from '~/app/models/admin/integration.server'

export const validator = withZod(
  z.object({
    provider: z.enum(['github', 'gitlab'], { required_error: 'provider is required' }),
    method: z.enum(['token'], { required_error: 'token is required' }),
    token: z.string().min(1, { message: 'token is required' })
  })
)

export const loader = async ({ request, params }: LoaderArgs) => {
  invariant(params.companyId, 'company id shoud specified')
  const integration = await getIntegration(params.companyId)
  if (integration) {
    // already added
    return redirect(`/admin/${params.companyId}`)
  }
  return integration
}

export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.companyId, 'company id shoud specified')
  const { error, data } = await validator.validate(await request.formData())
  if (error) {
    return validationError(error)
  }
  return await createIntegration({
    companyId: params.companyId,
    provider: data.provider,
    method: data.method,
    privateToken: data.token
  })
}

const AddIntegrationModal = () => {
  return (
    <AppMutationModal
      title="Add integration"
      footer={
        <Stack direction="row">
          <AppSubmitButton colorScheme="blue" type="submit" form="form">
            Add
          </AppSubmitButton>
          <AppLink to="..">
            <Button variant="ghost">Cancel</Button>
          </AppLink>
        </Stack>
      }
    >
      <ValidatedForm method="post" id="form" validator={validator}>
        <Stack>
          <AppRadioGroup name="provider" label="Provider">
            <Stack direction="row" gap="4">
              <Radio value="github">
                <Stack direction="row" align="center">
                  <Icon as={RiGithubFill} />
                  <Box>GitHub</Box>
                </Stack>
              </Radio>
              <Radio value="gitlab">
                <Stack direction="row" align="center">
                  <Icon as={RiGitlabFill} />
                  <Box>GitLab</Box>
                </Stack>
              </Radio>
            </Stack>
          </AppRadioGroup>

          <AppRadioGroup name="method" label="Method">
            <Radio value="token">Private Token</Radio>
          </AppRadioGroup>

          <AppTextarea name="token" label="Token"></AppTextarea>
        </Stack>
      </ValidatedForm>
    </AppMutationModal>
  )
}
export default AddIntegrationModal
