import { Box, Button, FormLabel, Input, Radio, RadioGroup, Stack, Icon } from '@chakra-ui/react'
import type { LoaderArgs, ActionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Form } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { zfd } from 'zod-form-data'
import { AppLink } from '~/app/components/AppLink'
import { AppMutationModal } from '~/app/components/AppMutationModal'
import { createIntegration, getIntegration } from '~/app/models/admin/integration.server'
import { RiGithubFill, RiGitlabFill } from 'react-icons/ri'

const providerSchema = zfd.formData({
  provider: zfd.text(),
  method: zfd.text(),
  token: zfd.text()
})

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
  const formData = await request.formData()
  const { provider, method, token } = providerSchema.parse(formData)
  if (!(provider === 'github' || provider === 'gitlab')) {
    throw new Error('provider not supported')
  }
  return await createIntegration({ companyId: params.companyId, provider, method, privateToken: token })
}

const AddIntegrationModal = () => {
  return (
    <AppMutationModal
      title="Add integration"
      footer={
        <Stack direction="row">
          <Button colorScheme="blue" type="submit" form="form">
            Add
          </Button>
          <AppLink to="..">
            <Button variant="ghost">Cancel</Button>
          </AppLink>
        </Stack>
      }
    >
      <Form method="post" action="." id="form">
        <Box display="grid" gridTemplateColumns="auto 1fr" gap="4" alignItems="center">
          <FormLabel m="0">Provider</FormLabel>
          <RadioGroup>
            <Stack direction="row" gap="4">
              <Radio name="provider" value="github">
                <Stack direction="row" align="center">
                  <Icon as={RiGithubFill} />
                  <Box>GitHub</Box>
                </Stack>
              </Radio>
              <Radio name="provider" value="gitlab">
                <Stack direction="row" align="center">
                  <Icon as={RiGitlabFill} />
                  <Box>GitLab</Box>
                </Stack>
              </Radio>
            </Stack>
          </RadioGroup>

          <FormLabel m="0">Method</FormLabel>
          <RadioGroup value="token">
            <Stack direction="row">
              <Radio name="method" value="token">
                Private Token
              </Radio>
            </Stack>
          </RadioGroup>

          <FormLabel m="0" htmlFor="token">
            Token
          </FormLabel>
          <Input name="token" id="token"></Input>
        </Box>
      </Form>
    </AppMutationModal>
  )
}
export default AddIntegrationModal
