import {
  Stack,
  Box,
  Spacer,
  Accordion,
  AccordionPanel,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Badge,
  chakra
} from '@chakra-ui/react'
import React, { useState, useCallback } from 'react'
import { uniq } from 'remeda'
import dayjs from 'dayjs'
import type { GitRepo } from '../interfaces/model'

interface CheckedRepositories {
  [id: string]: boolean
}

interface RepositoryListProps {
  allRepos: GitRepo[]
  onChange: (repos: GitRepo[]) => void // 選択変更
}
export const RepositoryList = ({ allRepos, onChange }: RepositoryListProps) => {
  const [checkedRepos, setCheckedRepos] = useState<CheckedRepositories>({})
  const orgs = uniq(allRepos.map((repo) => repo.owner) ?? [])

  const selectedRepos = useCallback(
    (checked: CheckedRepositories) => allRepos.filter((repo) => Object.keys(checked).includes(repo.id)) || [],
    [allRepos]
  )

  // organization をチェック・クリアされたらまとめてレポジトリもチェック・クリア
  const handleClickOrgCheckbox = useCallback(
    (org: string, isPrevChecked: boolean) => {
      const orgRepos = allRepos.filter((repo) => repo.owner === org) || []
      const newCheckedRepos = { ...checkedRepos }
      for (const repo of orgRepos) {
        if (isPrevChecked) {
          delete newCheckedRepos[repo.id]
        } else {
          newCheckedRepos[repo.id] = true
        }
      }
      setCheckedRepos(newCheckedRepos)
      onChange(selectedRepos(newCheckedRepos))
    },
    [allRepos, checkedRepos, onChange, selectedRepos]
  )

  const handleClickRepoCheckbox = useCallback(
    (id: string) => {
      const newCheckedRepos = { ...checkedRepos }
      if (checkedRepos[id]) {
        delete newCheckedRepos[id]
      } else {
        newCheckedRepos[id] = true
      }
      setCheckedRepos(newCheckedRepos)
      onChange(selectedRepos(newCheckedRepos))
    },
    [checkedRepos, onChange, selectedRepos]
  )

  // 初期状態で選択済みのリポジトリ
  /*
  useEffect(() => {
    if (allRepos) {
      const prevCheckedRepos: { [id: string]: boolean } = {}
      for (const repo of config.repositories) {
        prevCheckedRepos[repo.id] = true
      }
      setCheckedRepos(prevCheckedRepos)
    }
  }, [data, config.repositories])
  */

  return (
    <>
      <Stack>
        <Accordion allowToggle>
          {!!orgs &&
            orgs.map((org) => {
              const orgRepos = allRepos.filter((repo) => repo.owner == org) || []
              const checkedRepoNum = orgRepos.filter((repo) => !!checkedRepos[repo.id]).length
              const isOrgChecked = checkedRepoNum > 0
              const isOrgIndeterminate = checkedRepoNum > 0 && checkedRepoNum != orgRepos.length

              return (
                <React.Fragment key={org}>
                  <AccordionItem>
                    <Box>
                      <AccordionButton display="flex">
                        <Stack direction="row" align="center">
                          <Checkbox
                            isChecked={isOrgChecked}
                            isIndeterminate={isOrgIndeterminate}
                            onClick={(e) => {
                              e.stopPropagation() // acordion 開閉させない
                            }}
                            onChange={(e) => {
                              handleClickOrgCheckbox(org, isOrgChecked)
                            }}
                          ></Checkbox>
                          <Box>{org}</Box>
                          <Box fontSize="sm" color="gray.500">
                            {checkedRepoNum} / {orgRepos.length} repos
                          </Box>
                        </Stack>

                        <Spacer />
                        <AccordionIcon />
                      </AccordionButton>
                    </Box>

                    <AccordionPanel>
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
                                    handleClickRepoCheckbox(repo.id) // 行クリックでも発動
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
                                        onChange={(e) => handleClickRepoCheckbox(repo.id)}
                                        sx={{
                                          'accent-color': '#3182ce'
                                        }}
                                      />
                                      <Box>{repo.name}</Box>
                                    </Stack>
                                  </Td>

                                  <Td
                                    width="16rem"
                                    wordBreak="break-all"
                                    whiteSpace="break-spaces"
                                    fontSize="xs"
                                    color="gray.500"
                                  >
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
                    </AccordionPanel>
                  </AccordionItem>
                </React.Fragment>
              )
            })}
        </Accordion>
      </Stack>
    </>
  )
}
