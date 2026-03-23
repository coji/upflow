import consola from 'consola'
import schedule from 'node-schedule'
import { captureExceptionToSentry } from '~/app/libs/sentry-node.server'
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

          try {
            await durably.jobs.crawl.trigger(
              { organizationId: orgId, refresh: false },
              {
                concurrencyKey: `crawl:${orgId}`,
                labels: { organizationId: orgId },
              },
            )
            logger.info(`crawl job triggered for ${org.name}`)
          } catch (e) {
            logger.error(`failed to trigger crawl for ${org.name}:`, orgId, e)
            captureExceptionToSentry(e, {
              tags: { component: 'job-scheduler', operation: 'crawl.trigger' },
              extra: { organizationId: orgId, organizationName: org.name },
            })
          }
        }

        logger.info('crawl cycle completed.')
      } catch (e) {
        logger.error(e)
        captureExceptionToSentry(e, {
          tags: { component: 'job-scheduler', operation: 'crawl.cycle' },
        })
      }
    })
  }

  return { startScheduler }
}
