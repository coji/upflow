import { describe, expect, test } from 'vitest'
import { classifyPrType, type PrTypeInput } from './pr-type'

const base: PrTypeInput = {
  title: 'Add search filters',
  sourceBranch: 'feature/search-filters',
  targetBranch: 'main',
  authorIsBot: false,
}

const classify = (overrides: Partial<PrTypeInput>) =>
  classifyPrType({ ...base, ...overrides })

describe('classifyPrType', () => {
  test('a regular work PR is normal', () => {
    expect(classify({})).toEqual({ prType: 'normal', prTypeWarning: null })
  })

  test.each([
    ['release title', { title: 'Release v2.4.0', sourceBranch: 'develop' }],
    [
      'release-please title and branch',
      {
        title: 'chore(main): release 1.8.0',
        sourceBranch: 'release-please--branches--main',
        authorIsBot: true,
      },
    ],
    [
      'tagged release title',
      { title: '[web] Release 1.2.0', sourceBranch: 'web-dev' },
    ],
    [
      'product-prefixed release title',
      { title: 'Mobile release 2.3.1', sourceBranch: 'mobile-2.3.1-dev' },
    ],
    [
      'release title with a component version',
      { title: 'Release app-1.2.4', sourceBranch: 'app-dev' },
    ],
    ['release branch', { title: 'v2.4.0', sourceBranch: 'release/2.4.0' }],
    [
      'main -> production deploy flow',
      {
        title: 'Deploy to production',
        sourceBranch: 'main',
        targetBranch: 'production',
      },
    ],
    [
      'master -> prod deploy flow',
      { title: 'Sync', sourceBranch: 'master', targetBranch: 'prod' },
    ],
  ])('%s is release', (_label, overrides) => {
    expect(classify(overrides)).toEqual({
      prType: 'release',
      prTypeWarning: null,
    })
  })

  test('release outranks the bot author', () => {
    expect(
      classify({ title: 'Release 3.0.0', sourceBranch: 'x', authorIsBot: true })
        .prType,
    ).toBe('release')
  })

  test.each([
    [
      'template merge title',
      { title: 'Merged base-template into app-derived', sourceBranch: 'sync' },
    ],
    [
      'template_update-* branch',
      { title: 'Update from template', sourceBranch: 'template_update-42' },
    ],
    [
      'template/* branch',
      { title: 'Pull template changes', sourceBranch: 'template/2026-10' },
    ],
  ])('%s is template-merge', (_label, overrides) => {
    expect(classify(overrides)).toEqual({
      prType: 'template-merge',
      prTypeWarning: null,
    })
  })

  test.each([
    [
      'renovate',
      {
        title: 'chore(deps): update dependency vitest to v5',
        sourceBranch: 'renovate/vitest-5.x',
      },
    ],
    [
      'dependabot',
      {
        title: 'Bump left-pad from 1.0.0 to 1.1.0',
        sourceBranch: 'dependabot/npm_and_yarn/left-pad-1.1.0',
      },
    ],
    [
      'a self-hosted renovate branch',
      { title: 'Update node to v24', sourceBranch: 'selfhost-renovate/node' },
    ],
  ])('a bot %s PR is dependency', (_label, overrides) => {
    expect(classify({ ...overrides, authorIsBot: true })).toEqual({
      prType: 'dependency',
      prTypeWarning: null,
    })
  })

  test('a bot PR that is not a dependency update stays normal', () => {
    expect(
      classify({
        title: 'feat: add a CSV export',
        sourceBranch: 'agent/1234-csv-export',
        authorIsBot: true,
      }).prType,
    ).toBe('normal')
  })

  test('a human PR that bumps a dependency stays normal', () => {
    expect(
      classify({ title: 'Bump react to 19', sourceBranch: 'chore/react-19' })
        .prType,
    ).toBe('normal')
  })

  test('the deploy flow needs both branches: main -> develop is normal', () => {
    expect(
      classify({ sourceBranch: 'main', targetBranch: 'develop' }).prType,
    ).toBe('normal')
  })

  test('a release title on a work branch is release with a warning', () => {
    expect(
      classify({ title: 'Release 2.6.0', sourceBranch: 'feature/2.5.3' }),
    ).toEqual({ prType: 'release', prTypeWarning: 'signal-conflict' })
  })

  test('release and template signals together are flagged', () => {
    expect(
      classify({
        title: 'Merged base-template into app-derived',
        sourceBranch: 'release/1.0',
      }),
    ).toEqual({ prType: 'release', prTypeWarning: 'signal-conflict' })
  })

  test('titles that merely mention a release stay normal', () => {
    expect(classify({ title: 'Fix the release notes link' }).prType).toBe(
      'normal',
    )
    expect(classify({ title: 'Prereleases: skip tag lookup' }).prType).toBe(
      'normal',
    )
    expect(
      classify({ title: 'fix: release branch detection on exact names' })
        .prType,
    ).toBe('normal')
    expect(
      classify({ title: 'release.sh: accept any remote URL' }).prType,
    ).toBe('normal')
    expect(
      classify({ title: 'Release notes: add a changelog link' }).prType,
    ).toBe('normal')
  })
})
