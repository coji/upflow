import { match } from 'ts-pattern'
import { createGitHubProvider } from './github'
import { createGitLabProvider } from './gitlab'

export const createProvider = (provider: string) => {
  const factory = match(provider)
    .with('github', () => createGitHubProvider)
    .with('gitlab', () => createGitLabProvider)
    .otherwise(() => null)
  return factory && factory()
}
