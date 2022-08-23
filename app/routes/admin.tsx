import type { LoaderArgs } from '@remix-run/server-runtime'
import { requireUserId } from '~/app/session.server'

import { NavLink, Outlet } from '@remix-run/react'
import { Box, Flex, Spacer, Heading, Container, Stack, Tag } from '@chakra-ui/react'
import { useUser } from '~/app/utils'

export const loader = async ({ request }: LoaderArgs) => {
  await requireUserId(request)
  return {}
}

const AdminIndex = () => {
  const user = useUser()

  return (
    <Box display="grid" gridTemplateRows="auto 1fr auto" height="100vh" color="gray.600">
      <Flex as="header" px="4" py="1" align="center" boxShadow="md">
        <Heading>
          <NavLink to="/admin/company">UpFlow</NavLink>
        </Heading>

        <Spacer />
        <Stack direction="row" align="center">
          <Tag colorScheme="red" size="sm">
            Admin
          </Tag>
          <Box textAlign="right">{user.name} </Box>
        </Stack>
      </Flex>

      <Box as="main" bgColor="gray.200">
        <Container p="4" maxWidth="container.xl">
          <Outlet />
        </Container>
      </Box>

      <Box as="footer" textAlign="center" p="4" boxShadow="md">
        Copyright&copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
export default AdminIndex
