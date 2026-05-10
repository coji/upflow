import { describe, expect, test } from 'vitest'
import { classifyPrType } from './pr-type'

const baseInput = {
  title: 'Add user settings',
  sourceBranch: 'feature/user-settings',
  targetBranch: 'main',
  author: 'alice',
  authorIsBot: false,
  botLogins: new Set<string>(),
}

describe('classifyPrType', () => {
  test('classifies release by release branch', () => {
    expect(
      classifyPrType({
        ...baseInput,
        title: 'Prepare 1.2.3',
        sourceBranch: 'release/1.2.3',
      }),
    ).toEqual({ prType: 'release', prTypeWarning: null })
  })

  test('classifies template-merge by merged title', () => {
    expect(
      classifyPrType({
        ...baseInput,
        title: 'Merged main into product-a',
      }),
    ).toEqual({ prType: 'template-merge', prTypeWarning: null })
  })

  test('classifies dependency by bot author after release/template checks', () => {
    expect(
      classifyPrType({
        ...baseInput,
        title: 'Bump vite from 8.0.7 to 8.0.8',
        author: 'dependabot[bot]',
        authorIsBot: true,
      }),
    ).toEqual({ prType: 'dependency', prTypeWarning: null })
  })

  test('classifies normal fallback', () => {
    expect(classifyPrType(baseInput)).toEqual({
      prType: 'normal',
      prTypeWarning: null,
    })
  })

  test('writes signal-conflict warning while keeping release priority', () => {
    expect(
      classifyPrType({
        ...baseInput,
        title: 'Release 2.6.0',
        sourceBranch: 'feature/2.5.3',
      }),
    ).toEqual({ prType: 'release', prTypeWarning: 'signal-conflict' })
  })

  test('keeps out-of-convention PRs as normal fallback', () => {
    expect(
      classifyPrType({
        ...baseInput,
        title: 'Ship changes',
        sourceBranch: 'misc/ship-it',
        targetBranch: 'develop',
      }),
    ).toEqual({ prType: 'normal', prTypeWarning: null })
  })

  test('classifies main or master to production flow as release', () => {
    expect(
      classifyPrType({
        ...baseInput,
        title: 'Production deployment',
        sourceBranch: 'main',
        targetBranch: 'production',
      }),
    ).toEqual({ prType: 'release', prTypeWarning: null })

    expect(
      classifyPrType({
        ...baseInput,
        title: 'Deploy to prod',
        sourceBranch: 'master',
        targetBranch: 'prod',
      }),
    ).toEqual({ prType: 'release', prTypeWarning: null })
  })

  test('classifies template_update branch as template-merge', () => {
    expect(
      classifyPrType({
        ...baseInput,
        title: 'Update generated app template',
        sourceBranch: 'template_update-20260510',
      }),
    ).toEqual({ prType: 'template-merge', prTypeWarning: null })
  })
})
