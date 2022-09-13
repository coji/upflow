import { Box, Button, FormLabel, Input, Stack, Textarea } from '@chakra-ui/react'
import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { redirect } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { zfd } from 'zod-form-data'
import { AppLink } from '~/app/components/AppLink'
import { AppMutationModal } from '~/app/components/AppMutationModal'
import { upsertExportSetting, getExportSetting } from '~/app/models/admin/export-setting.server'

const schema = zfd.formData({
  sheetId: zfd.text(),
  clientEmail: zfd.text(),
  privateKey: zfd.text()
})

export const loader = async ({ params }: LoaderArgs) => {
  invariant(params.companyId, 'company id shoud specified')
  const exportSetting = await getExportSetting(params.companyId)
  return exportSetting
}

export const action = async ({ request, params }: ActionArgs) => {
  invariant(params.companyId, 'company id shoud specified')
  const formData = await request.formData()
  const { sheetId, clientEmail, privateKey } = schema.parse(formData)
  await upsertExportSetting({ companyId: params.companyId, sheetId, clientEmail, privateKey })
  return redirect(`/admin/${params.companyId}`)
}

const ExportSetting = () => {
  const exportSetting = useLoaderData<typeof loader>()

  return (
    <AppMutationModal
      title="Export Setting"
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
      <Form method="post" id="form">
        <Box display="grid" gridTemplateColumns="auto 1fr" gap="4" alignItems="center">
          <FormLabel m="0" htmlFor="sheetId">
            Sheet Id
          </FormLabel>
          <Input name="sheetId" id="sheetId" defaultValue={exportSetting?.sheetId}></Input>

          <FormLabel m="0" htmlFor="clientEmail">
            Client Email
          </FormLabel>
          <Input name="clientEmail" id="clientEmail" defaultValue={exportSetting?.clientEmail}></Input>

          <FormLabel m="0" htmlFor="privateKey">
            Private Key
          </FormLabel>
          <Textarea name="privateKey" id="privateKey" defaultValue={exportSetting?.privateKey}></Textarea>
        </Box>
      </Form>
    </AppMutationModal>
  )
}
export default ExportSetting
