import { Box, Container, Flex, Heading, Menu, MenuItem, MenuList, Spacer, Stack } from '@chakra-ui/react'
import type { LoaderArgs, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Outlet, useSubmit } from '@remix-run/react'
import { AppLink, AppProfileMenuButton } from '~/app/components'
import { requireUser } from '~/app/utils/session.server'
import { useUser } from '~/app/utils/utils'

export const loader = async ({ request }: LoaderArgs) => {
  await requireUser(request)
  return redirect('/admin')
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
          <AppLink to="/" color="gray.600">
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
