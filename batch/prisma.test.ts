import { test } from 'vitest'

const prisma = vPrisma.client

// @vitest-environment-options { "verboseQuery": true }
test('user creation test', async () => {
  const user = await prisma.user.create({ data: { email: 'this is a test' } })
  expect(user.email).toStrictEqual('this is a test')
})
