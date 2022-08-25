import { Box, Button, FormLabel, Input, Radio, RadioGroup, Stack } from '@chakra-ui/react'
import type { ActionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { zfd } from 'zod-form-data'
import { AppLink } from '~/app/components/AppLink'
import { AppMutationModal } from '~/app/components/AppMutationModal'
import { createIntegration } from '~/app/models/admin/integration.server'

const providerSchema = zfd.formData({
  provider: zfd.text(),
  method: zfd.text(),
  token: zfd.text()
})

export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.companyId, 'company id shout specified')
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
            <Stack direction="row">
              <Radio name="provider" value="github">
                GitHub
              </Radio>
              <Radio name="provider" value="gitlab">
                GitLab
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
          {/* repositories */}
          {/* gitlab: projectId */}
          {/* github: owner, repo */}
        </Box>
      </Form>
    </AppMutationModal>
  )
}
export default AddIntegrationModal
