import type { Integration } from '@prisma/client'
import { useQuery } from '@tanstack/react-query'
import { listGithubRepos } from '../services/listGithubRepos'
import { sortBy } from 'remeda'

export const useGithubRepoQuery = (integration: Integration | null) =>
  useQuery(['setup', 'repos'], () => listGithubRepos(integration?.privateToken ?? ''), {
    enabled: !!integration?.privateToken,
    select: (repos) => sortBy(repos, [(repo) => repo.pushedAt ?? '2000-01-01T00:00:00Z', 'desc']),
  })
