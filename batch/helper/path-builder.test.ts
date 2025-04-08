import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { createPathBuilder } from './path-builder'

describe('path-builder', () => {
  test('jsonPath', () => {
    const organizationId = 'test-company'
    const repositoryId = 'test-repository'
    const pathBuilder = createPathBuilder({ organizationId, repositoryId })

    const dataDir = path.join(import.meta.dirname, '..', 'data', 'json') // App's root directory
    expect(pathBuilder.jsonPath('test.json')).toStrictEqual(
      `${dataDir}/test-company/test-repository/test.json`,
    )
  })

  test('jsonPath defined UPFLOW_DATA_DIR', () => {
    const organizationId = 'test-company'
    const repositoryId = 'test-repository'
    const pathBuilder = createPathBuilder({ organizationId, repositoryId })
    process.env.UPFLOW_DATA_DIR = '/'

    expect(pathBuilder.jsonPath('test.json')).toStrictEqual(
      '/json/test-company/test-repository/test.json',
    )
  })
})
