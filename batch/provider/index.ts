import type { Integration } from '@prisma/client'
import { match } from 'ts-pattern'
import { createGitHubProvider } from './github'
import { createGitLabProvider } from './gitlab'

export const createProvider = (integration: Integration) =>
  match(integration.provider)
    .with('github', () => createGitHubProvider(integration))
    .with('gitlab', () => createGitLabProvider(integration))
    .otherwise(() => null)
