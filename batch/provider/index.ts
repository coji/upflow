import type { Integration } from '@prisma/client'
import { match } from 'ts-pattern'
import { createGitHubProvider } from './github'

export const createProvider = (integration: Integration) =>
  match(integration.provider)
    .with('github', () => createGitHubProvider(integration))
    .otherwise(() => null)
