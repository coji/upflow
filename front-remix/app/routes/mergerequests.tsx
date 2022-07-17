import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireUserId } from '~/session.server'
import type { MergeRequest } from '~/models/mergeRequest.server'
import { getMergeRequestItems } from '~/models/mergeRequest.server'

import { memo } from 'react'
import { Form, Link, NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { Heading, Stack, Box, Flex, Spacer, Text, Button, Badge, Tag } from '@chakra-ui/react'

import { useUser } from '~/utils'

export const loader: LoaderFunction = async ({ request }) => {
  await requireUserId(request)
  return json<MergeRequest[]>(await getMergeRequestItems()) // ページコンポーネントの useLoaderData で使用
}

const MergeRequestPage = memo(() => {
  const mergeRequestItems = useLoaderData() as MergeRequest[] // loader 関数が返した json を取得
  const user = useUser()

  return (
    <Box>
      <Flex alignItems="center" bgColor="white" p="4" textColor="slategray">
        <Heading>
          <Link to=".">Up Flow</Link>
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
              <Stack px="4" py="1" gap="0" boxShadow="sm" bgColor="white" _hover={{ bgColor: 'gray.100' }} rounded="md">
                <Stack direction="row">
                  <Box>
                    <Badge size="sm" variant="outline" colorScheme={mr.state === 'merged' ? 'blue' : 'green'}>
                      {mr.state}
                    </Badge>
                  </Box>
                  <Text>{mr.title}</Text>
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

        <Box p="6" width="20rem">
          <Outlet />
        </Box>
      </Flex>
    </Box>
  )
})
export default MergeRequestPage
