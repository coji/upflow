import { clearOrgCache } from '~/app/services/cache.server'
import { runInstallationWebhookInTransaction } from '~/app/services/github-webhook-installation.server'
import { handlePullWebhookEvent } from '~/app/services/github-webhook-pull.server'
import { isRecord } from '~/app/services/github-webhook-shared.server'

/**
 * Shared-DB updates (installation) and PR webhook enqueue.
 * Call after signature verification and JSON parse. Unknown events are no-ops.
 */
export async function processGithubWebhookPayload(
  event: string | null,
  payload: unknown,
): Promise<void> {
  if (!event || !isRecord(payload)) return

  if (event === 'installation' || event === 'installation_repositories') {
    const result = await runInstallationWebhookInTransaction(event, payload)
    if (result.organizationId) clearOrgCache(result.organizationId)
    return
  }

  if (
    event === 'pull_request' ||
    event === 'pull_request_review' ||
    event === 'pull_request_review_comment'
  ) {
    await handlePullWebhookEvent(event, payload)
  }
}
