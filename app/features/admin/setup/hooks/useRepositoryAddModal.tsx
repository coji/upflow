import type { Integration } from '@prisma/client'
import { Link } from '@remix-run/react'
import { useCallback, useState } from 'react'
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, HStack, Spacer } from '~/app/components/ui'
import { RepositoryList } from '../components/RepositoryList'
import type { GitRepo } from '../interfaces/model'
import { useGithubRepoQuery } from './useGithubReposQuery'

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
    <Card>
      <CardHeader>
        <CardTitle>Add GitHub repositories</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Loading...</p> : <RepositoryList allRepos={data ?? []} onChange={handleChangeCheckedRepos} />}
      </CardContent>
      <CardFooter>
        <HStack>
          <Button
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
          <Button asChild variant="ghost">
            <Link to="..">Cancel</Link>
          </Button>
        </HStack>

        <Spacer />
        {checkedRepos.length > 0 && <p className="text-sm text-secondary">{checkedRepos.length} repos selected</p>}
      </CardFooter>
    </Card>
  )

  return {
    repositories: checkedRepos,
    RepositoryAddModal,
  }
}
