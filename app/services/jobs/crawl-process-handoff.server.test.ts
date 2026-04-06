import { describe, expect, test } from 'vitest'
import { shouldTriggerFullOrgProcessJob } from './crawl-process-handoff.server'

describe('shouldTriggerFullOrgProcessJob', () => {
  test('repository-scoped refresh does not widen to full-org process', () => {
    expect(
      shouldTriggerFullOrgProcessJob({
        refresh: true,
        repositoryId: 'repo-uuid',
      }),
    ).toBe(false)
  })

  test('org-wide refresh without repository or PR targeting uses full-org process', () => {
    expect(
      shouldTriggerFullOrgProcessJob({
        refresh: true,
      }),
    ).toBe(true)
  })

  test('targeted PR refresh is not full-org', () => {
    expect(
      shouldTriggerFullOrgProcessJob({
        refresh: true,
        repositoryId: 'r1',
        prNumbers: [42],
      }),
    ).toBe(false)
  })

  test('incremental crawl without refresh is never full-org process branch', () => {
    expect(
      shouldTriggerFullOrgProcessJob({
        refresh: false,
      }),
    ).toBe(false)
  })
})
