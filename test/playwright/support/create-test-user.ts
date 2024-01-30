import { upsertUserByEmail } from '~/app/models/user.server'

export const createTestUser = async (
  props: Parameters<typeof upsertUserByEmail>[0],
) => {
  if (!props.email) {
    throw new Error('email required for login')
  }
  if (!props.email.endsWith('@example.com')) {
    throw new Error('All test emails must end in @example.com')
  }

  await upsertUserByEmail(props)
}
