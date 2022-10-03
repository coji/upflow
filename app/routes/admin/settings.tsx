import { Heading, Box, Stack } from '@chakra-ui/react'
import { ValidatedForm } from 'remix-validated-form'
import { withZod } from '@remix-validated-form/with-zod'
import { zfd } from 'zod-form-data'
import { z } from 'zod'
import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { AppInput, AppSubmitButton } from '~/app/components'
import { updatePassword } from '~/app/models/user.server'
import { getUser } from '~/app/utils/session.server'

const schema = zfd.formData({
  oldPassword: z.string().min(1, { message: 'current password shoud input' }),
  newPassword: z.string().min(1, { message: 'new password shoud input' })
})
const validator = withZod(schema)

export const action = async ({ request }: ActionArgs) => {
  const { oldPassword, newPassword } = schema.parse(await request.formData())
  const user = await getUser(request)
  if (!user) {
    return json({ error: 'invalid credential' })
  }
  const updated = await updatePassword(user.email, oldPassword, newPassword)
  return json(updated)
}

export default function SettingsPage() {
  return (
    <Box bgColor="white" rounded="md" p="4">
      <Heading>Admin Settings</Heading>
      <ValidatedForm method="post" validator={validator}>
        <Stack>
          <AppInput name="oldPassword" label="Current Password"></AppInput>
          <AppInput name="newPassword" label="New Password"></AppInput>

          <AppSubmitButton />
        </Stack>
      </ValidatedForm>
    </Box>
  )
}
