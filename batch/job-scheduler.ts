import consola from 'consola'
import schedule from 'node-schedule'
import type { OrganizationId } from '~/app/types/organization'
import { listAllOrganizations } from './db'
import { logger } from './helper/logger'

export const createJobScheduler = () => {
  let durably: typeof import('~/app/services/durably.server').durably

  const startScheduler = async () => {
    // Lazy import to avoid circular dependency and ensure durably is initialized
    const mod = await import('~/app/services/durably.server')
    durably = mod.durably

    consola.info('job scheduler started.')

    schedule.scheduleJob('30 * * * *', async () => {
      try {
        logger.info('crawl cycle started.')
        const organizations = await listAllOrganizations()

        for (const org of organizations) {
          if (!org.organizationSetting?.isActive) continue
          if (!org.integration) continue

          const orgId = org.id as OrganizationId
          const refresh = org.organizationSetting.refreshRequestedAt != null

          await durably.jobs.crawl.trigger(
            { organizationId: orgId, refresh },
            {
              concurrencyKey: `crawl:${orgId}`,
              labels: { organizationId: orgId },
            },
          )
          logger.info(`crawl job triggered for ${org.name}`)
        }

        logger.info('crawl cycle completed.')
      } catch (e) {
        logger.error(e)
      }
    })
  }

  return { startScheduler }
}
