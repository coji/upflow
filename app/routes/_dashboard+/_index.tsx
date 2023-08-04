import { Badge, Box, Flex, Stack, Tag, Text } from '@chakra-ui/react'
import type { LoaderArgs } from '@remix-run/node'
import { NavLink, Outlet } from '@remix-run/react'
import { memo } from 'react'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
import type { PullRequest } from '~/app/models/pullRequest.server'
import { getPullRequestItems } from '~/app/models/pullRequest.server'

export const loader = async ({ request }: LoaderArgs) => {
  return typedjson<PullRequest[]>(await getPullRequestItems())
}

const MergeRequestPage = memo(() => {
  const pullRequestItems = useTypedLoaderData<typeof loader>()

  return (
    <Flex as="main" height="full">
      <Stack p="2" flexGrow={1}>
        {pullRequestItems.map((pr) => (
          <NavLink key={`${pr.repositoryId}/${pr.number}`} to={`${pr.repositoryId}/${pr.number}`}>
            {({ isActive }) => (
              <Stack
                px="4"
                py="1"
                gap="0"
                boxShadow="sm"
                bgColor={isActive ? 'blue.100' : 'white'}
                _hover={{ bgColor: 'gray.50' }}
                rounded="md"
              >
                <Stack direction="row">
                  <Box>
                    <Badge size="sm" variant="outline" colorScheme={pr.state === 'merged' ? 'blue' : 'green'}>
                      {pr.state}
                    </Badge>
                  </Box>
                  <Text noOfLines={1}>{pr.title}</Text>
                </Stack>
                <Flex alignItems="center" justify="end">
                  <Tag fontSize="sm" colorScheme="blackAlpha">
                    {pr.author}
                  </Tag>
                </Flex>

                {isActive && <Outlet />}
              </Stack>
            )}
          </NavLink>
        ))}
      </Stack>
    </Flex>
  )
})
export default MergeRequestPage
