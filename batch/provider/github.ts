import type { Integration, Repository } from '@prisma/client'

export const createGitHubProvider = () => {
  const fetch = async (integration: Integration, repository: Repository, { refresh = false, halt = false }: { refresh?: boolean; halt?: boolean }) => {
    console.log('github provider fetch is not implemented yet.')
  }

  const upsert = async (repositories: Repository[]) => {
    console.log('github provider upsert is not implemented yet')
  }

  return {
    fetch,
    upsert
  }
}
