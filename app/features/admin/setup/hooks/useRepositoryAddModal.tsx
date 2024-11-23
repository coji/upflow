import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  HStack,
  Spacer,
} from '~/app/components/ui'
import type { DB, Selectable } from '~/app/services/db.server'
import { RepositoryList } from '../components/RepositoryList'
import type { GithubRepo } from '../interfaces/model'
import { useGithubRepoQuery } from './useGithubReposQuery'

interface useRepositoryAddModalProps {
  integration: Selectable<DB.Integration>
  onSubmit: (repos: GithubRepo[]) => boolean
}
export const useRepositoryAddModal = ({
  integration,
  onSubmit,
}: useRepositoryAddModalProps) => {
  const { data, isLoading } = useGithubRepoQuery(integration)
  const [checkedRepos, setCheckedRepos] = useState<GithubRepo[]>([])

  const handleChangeCheckedRepos = useCallback((checkedRepos: GithubRepo[]) => {
    setCheckedRepos(checkedRepos)
  }, [])

  const RepositoryAddModal = (
    <Card>
      <CardHeader>
        <CardTitle>Add GitHub Repositories</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <RepositoryList
            allRepos={data ?? []}
            onChange={handleChangeCheckedRepos}
          />
        )}
      </CardContent>
      <CardFooter>
        <HStack>
          <Button
            type="button"
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
            <Link to="./..">Cancel</Link>
          </Button>
        </HStack>

        <Spacer />
        {checkedRepos.length > 0 && (
          <p className="text-sm text-secondary">
            {checkedRepos.length} repos selected
          </p>
        )}
      </CardFooter>
    </Card>
  )

  return {
    repositories: checkedRepos,
    RepositoryAddModal,
  }
}
