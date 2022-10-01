import { Badge, Box, chakra, Stack, Table, TableContainer, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react'
import dayjs from 'dayjs'
import type { GitRepo } from '../interfaces/model'
import type { CheckedRepositories } from './RepositoryList'

interface OrgRepositoryListProps {
  orgRepos: GitRepo[]
  checkedRepos: CheckedRepositories
  onCheck: (id: string) => void
}
export const OrgRepositoryList = ({ orgRepos, checkedRepos, onCheck }: OrgRepositoryListProps) => {
  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th width="16rem">Repository</Th>
            <Th width="16rem">Path</Th>
            <Th width="10rem" textAlign="center">
              Last Pushed
            </Th>
            <Th width="10rem" textAlign="center">
              Created
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {orgRepos.map((repo) => {
            const isActive = dayjs(repo.pushedAt) > dayjs().add(-90, 'days')

            return (
              <Tr
                key={repo.id}
                _hover={{
                  bgColor: 'gray.50',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  onCheck(repo.id) // 行クリックでも発動
                }}
              >
                <Td width="16rem" wordBreak="break-all" whiteSpace="break-spaces">
                  <Stack direction="row">
                    {/* Checkbox はアニメーションするためまとめて変更するとめっちゃ遅いので数が多いこれは input に */}
                    <chakra.input
                      type="checkbox"
                      checked={checkedRepos[repo.id]}
                      onClick={(e) => {
                        e.stopPropagation() // テーブル行クリックを発動させない
                      }}
                      onChange={(e) => onCheck(repo.id)}
                      sx={{
                        'accent-color': '#3182ce'
                      }}
                    />
                    <Box>{repo.name}</Box>
                  </Stack>
                </Td>

                <Td width="16rem" wordBreak="break-all" whiteSpace="break-spaces" fontSize="xs" color="gray.500">
                  {repo.full_name}
                </Td>

                <Td fontSize="sm" color="gray.500" width="10rem" textAlign="center">
                  <Box>
                    {isActive ? (
                      <Badge variant="outline" colorScheme="green">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" colorScheme="gray">
                        Inactive
                      </Badge>
                    )}
                  </Box>

                  <Box fontSize="xs">{dayjs(repo.pushedAt).format('YYYY-MM-DD')}</Box>
                </Td>

                <Td fontSize="xs" color="gray.500" width="10rem" textAlign="center">
                  {dayjs(repo.createdAt).format('YYYY-MM-DD')}
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </TableContainer>
  )
}
