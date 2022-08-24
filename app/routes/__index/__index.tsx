import { Badge, Box, Flex, Stack, Tag, Text } from '@chakra-ui/react'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { memo } from 'react'
import type { MergeRequest } from '~/app/models/mergeRequest.server'
import { getMergeRequestItems } from '~/app/models/mergeRequest.server'
import { requireUserId } from '~/app/session.server'

export const loader = async ({ request }: LoaderArgs) => {
  await requireUserId(request)
  return json<MergeRequest[]>(await getMergeRequestItems())
}

const MergeRequestPage = memo(() => {
  const mergeRequestItems = useLoaderData<typeof loader>()

  return (
    <Flex as="main" height="full">
      <Stack p="2" flexGrow={1}>
        {mergeRequestItems.map((mr) => (
          <NavLink key={`${mr.repositoryId}/${mr.id}`} to={`${mr.repositoryId}/${mr.id}`}>
            {({ isActive }) => (
              <Stack px="4" py="1" gap="0" boxShadow="md" bgColor={isActive ? 'blue.100' : 'white'} _hover={{ bgColor: 'gray.50' }} rounded="md">
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
            )}
          </NavLink>
        ))}
      </Stack>

      <Outlet />
    </Flex>
  )
})
export default MergeRequestPage
