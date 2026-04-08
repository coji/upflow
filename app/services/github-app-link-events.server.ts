import type { Kysely, Transaction } from 'kysely'
import { db } from '~/app/services/db.server'
import type { DB } from '~/app/services/type'
import type { OrganizationId } from '~/app/types/organization'

export type GithubAppLinkEventType =
  | 'link_created'
  | 'link_deleted'
  | 'link_suspended'
  | 'link_unsuspended'
  | 'membership_initialized'
  | 'membership_repaired'
  | 'membership_synced'
  | 'canonical_reassigned'
  | 'canonical_cleared'
  | 'assignment_required'

export type GithubAppLinkEventSource =
  | 'setup_callback'
  | 'installation_webhook'
  | 'installation_repositories_webhook'
  | 'user_disconnect'
  | 'crawl_repair'
  | 'manual_reassign'
  | 'cli_repair'

export type GithubAppLinkEventStatus = 'success' | 'failed' | 'skipped'

export type LogGithubAppLinkEventInput = {
  organizationId: OrganizationId
  installationId: number
  eventType: GithubAppLinkEventType
  source: GithubAppLinkEventSource
  status: GithubAppLinkEventStatus
  details?: Record<string, unknown>
}

/**
 * Append an entry to the `github_app_link_events` audit log.
 *
 * Pass a transaction to commit the log together with the underlying mutation;
 * otherwise it writes against the default connection.
 */
export const logGithubAppLinkEvent = async (
  input: LogGithubAppLinkEventInput,
  dbOrTrx: Kysely<DB> | Transaction<DB> = db,
): Promise<void> => {
  await dbOrTrx
    .insertInto('githubAppLinkEvents')
    .values({
      organizationId: input.organizationId,
      installationId: input.installationId,
      eventType: input.eventType,
      source: input.source,
      status: input.status,
      detailsJson: input.details ? JSON.stringify(input.details) : null,
    })
    .execute()
}

/**
 * Best-effort variant: writes the audit log entry and swallows any error so the
 * caller's primary mutation is never affected by audit-log failures. Logs to
 * stderr if the write fails.
 */
export const tryLogGithubAppLinkEvent = async (
  input: LogGithubAppLinkEventInput,
): Promise<void> => {
  try {
    await logGithubAppLinkEvent(input)
  } catch (e) {
    console.error('[github_app_link_events] failed to write audit log entry', e)
  }
}
