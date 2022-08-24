import type { LoaderArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireUser } from '~/app/session.server'

import { Outlet, useSubmit } from '@remix-run/react'
import { Heading, Stack, Box, Container, Flex, Spacer, Menu, MenuList, MenuItem } from '@chakra-ui/react'
import { AppLink } from '~/app/components/AppLink'
import { AppProfileMenuButton } from '../components/AppProfileMenuButton'
import { useUser } from '~/app/utils'

export const loader = async ({ request }: LoaderArgs) => {
  await requireUser(request)
  return json({})
}

export const meta: MetaFunction = () => {
  return {
    title: 'UpFlow'
  }
}

export default function IndexPage() {
  const user = useUser()
  const submit = useSubmit()

  return (
    <Box display="grid" gridTemplateRows="auto 1fr auto" bgColor="gray.100" minH="100vh">
      <Flex alignItems="center" bgColor="white" p="2" textColor="slategray">
        <Heading>
          <AppLink to="/dashboard" color="gray.600">
            UpFlow
          </AppLink>
        </Heading>
        <Spacer />

        <Stack direction="row" alignItems="center">
          <Menu>
            <AppProfileMenuButton name={user.name}></AppProfileMenuButton>
            <MenuList>
              <MenuItem
                onClick={() => {
                  submit(null, { method: 'post', action: 'logout' })
                }}
              >
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </Stack>
      </Flex>

      <Box>
        <Container maxW="container.xl">
          <Outlet />
        </Container>
      </Box>

      <Box as="footer" textAlign="center" bgColor="white" py="4">
        Copyright &copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
