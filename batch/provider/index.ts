import { match } from 'ts-pattern'
import type { DB, Selectable } from '~/app/services/db.server'
import { createGitHubProvider } from './github/provider'

export const createProvider = (integration: Selectable<DB.Integration>) =>
  match(integration.provider)
    .with('github', () => createGitHubProvider(integration))
    .otherwise(() => null)
