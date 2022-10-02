import { useState, useCallback } from 'react'
import { Box, Stack, Button, CircularProgress } from '@chakra-ui/react'
import { AppMutationModal, AppLink } from '~/app/components'
import { RepositoryList } from '../components/RepositoryList'
import { useGithubRepoQuery } from './useReposQuery'
import type { GitRepo } from '../interfaces/model'
import type { Integration } from '@prisma/client'

interface useRepositoryAddModalProps {
  integration: Integration | null
  onSubmit: (repos: GitRepo[]) => Promise<boolean>
}
export const useRepositoryAddModal = ({ integration, onSubmit }: useRepositoryAddModalProps) => {
  const { data, isLoading } = useGithubRepoQuery(integration)
  const [checkedRepos, setCheckedRepos] = useState<GitRepo[]>([])

  const handleChangeCheckedRepos = useCallback((checkedRepos: GitRepo[]) => {
    setCheckedRepos(checkedRepos)
  }, [])

  const RepositoryAddModal = (
    <AppMutationModal
      title="Add repositories"
      footer={
        <Stack direction="row" align="center">
          {checkedRepos.length > 0 && (
            <Box fontSize="sm" color="gray.400">
              {checkedRepos.length} repos selected
            </Box>
          )}
          <Button
            colorScheme="blue"
            type="submit"
            form="form"
            disabled={checkedRepos.length === 0}
            onClick={async () => {
              if (await onSubmit(checkedRepos)) {
                console.log('submit')
              }
            }}
          >
            Add
          </Button>
          <AppLink to="..">
            <Button variant="ghost">Cancel</Button>
          </AppLink>
        </Stack>
      }
      size="4xl"
      closeOnOverlayClick={false}
    >
      {isLoading ? (
        <CircularProgress isIndeterminate={isLoading} />
      ) : (
        <RepositoryList allRepos={data ?? []} onChange={handleChangeCheckedRepos} />
      )}
    </AppMutationModal>
  )

  return {
    repositories: checkedRepos,
    RepositoryAddModal
  }
}
