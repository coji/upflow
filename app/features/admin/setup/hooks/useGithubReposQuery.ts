import type { Integration } from '@prisma/client'
import { useQuery } from '@tanstack/react-query'
import { sortBy } from 'remeda'
import { listGithubRepos } from '../services/listGithubRepos'

export const useGithubRepoQuery = (integration: Integration) =>
  useQuery({
    queryKey: ['integration', integration.id],
    queryFn: () => listGithubRepos(integration?.privateToken ?? ''),
    enabled: !!integration?.privateToken,
    select: (repos) =>
      sortBy(repos, [
        (repo) => repo.pushedAt ?? '2000-01-01T00:00:00Z',
        'desc',
      ]),
  })
