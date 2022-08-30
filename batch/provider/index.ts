import { match } from 'ts-pattern'
import { createGitHubProvider } from './github'
import { createGitLabProvider } from './gitlab'
import type { Integration } from '@prisma/client'

export const createProvider = (integration: Integration) => {
  const factory = match(integration.provider)
    .with('github', () => createGitHubProvider)
    .with('gitlab', () => createGitLabProvider)
    .otherwise(() => null)
  return factory && factory(integration)
}
