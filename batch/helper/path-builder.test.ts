import { describe, expect, test } from 'vitest'
import type { OrganizationId } from '~/app/services/tenant-db.server'
import { createPathBuilder, getDataDir } from './path-builder'

describe('getDataDir', () => {
  test('returns default ./data', () => {
    expect(getDataDir()).toBe('./data')
  })
})

describe('path-builder', () => {
  test('jsonPath builds correct path', () => {
    const pathBuilder = createPathBuilder({
      organizationId: 'test-company' as OrganizationId,
      repositoryId: 'test-repository',
    })

    expect(pathBuilder.jsonPath('test.json')).toBe(
      'data/json/test-company/test-repository/test.json',
    )
  })
})
