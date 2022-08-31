import type { Integration, Repository } from '@prisma/client'
import { logger } from '~/batch/helper/logger'

export const createGitHubProvider = (integration: Integration) => {
  const fetch = async (repository: Repository, { refresh = false, halt = false }: { refresh?: boolean; halt?: boolean }) => {
    logger.info('github provider fetch is not implemented yet.')
  }

  const report = async (repositories: Repository[]) => {
    logger.info('github provider report is not implemented yet')
  }

  const upsert = async (repositories: Repository[]) => {
    logger.info('github provider upsert is not implemented yet')
  }

  return {
    fetch,
    report,
    upsert
  }
}
