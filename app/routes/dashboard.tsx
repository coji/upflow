import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireUserId } from '~/app/session.server'
import type { MergeRequest } from '~/app/models/mergeRequest.server'
import { getMergeRequestItems } from '~/app/models/mergeRequest.server'

import { memo } from 'react'
import { Form, NavLink, Outlet, useLoaderData, useLocation } from '@remix-run/react'
import { Heading, Stack, Box, Flex, Spacer, Text, Button, Badge, Tag } from '@chakra-ui/react'
import { AppLink } from '~/app/components/AppLink'
import { useUser } from '~/app/utils'

export const loader = async ({ request }: LoaderArgs) => {
  await requireUserId(request)
  return json<MergeRequest[]>(await getMergeRequestItems()) // ページコンポーネントの useLoaderData で使用
}

const MergeRequestPage = memo(() => {
  const mergeRequestItems = useLoaderData<typeof loader>() // loader 関数が返した json を取得
  const user = useUser()
  const location = useLocation()
  const currentId = location.pathname.split('/').at(2)

  return (
    <Box>
      <Flex alignItems="center" bgColor="white" p="4" textColor="slategray">
        <Heading>
          <AppLink to="." color="blue.800">
            UpFlow
          </AppLink>
        </Heading>
        <Spacer />
        <Stack direction="row" alignItems="center">
          <Text>{user.email}</Text>
          <Form action="/logout" method="post">
            <Button type="submit" colorScheme="blackAlpha">
              Logout
            </Button>
          </Form>
        </Stack>
      </Flex>

      <Flex as="main" height="full" bgColor="gray.200">
        <Stack p="2" flexGrow={1}>
          {mergeRequestItems.map((mr) => (
            <NavLink key={mr.id} to={mr.id}>
              <Stack px="4" py="1" gap="0" boxShadow="sm" bgColor={currentId === mr.id ? 'blue.100' : 'white'} _hover={{ bgColor: 'gray.100' }} rounded="md">
                <Stack direction="row">
                  <Box>
                    <Badge size="sm" variant="outline" colorScheme={mr.state === 'merged' ? 'blue' : 'green'}>
                      {mr.state}
                    </Badge>
                  </Box>
                  <Text noOfLines={1}>{mr.title}</Text>
                </Stack>
                <Flex alignItems="center" justify="end">
                  <Tag fontSize="sm" colorScheme="blackAlpha">
                    {mr.author}
                  </Tag>
                </Flex>
              </Stack>
            </NavLink>
          ))}
        </Stack>

        <Outlet />
      </Flex>
    </Box>
  )
})
export default MergeRequestPage
