import path from 'path'
import { describe, expect, test } from 'vitest'
import { createPathBuilder } from './path-builder'

describe('path-builder', () => {
  test('jsonPath', () => {
    const companyId = 'test-company'
    const repositoryId = 'test-repository'
    const pathBuilder = createPathBuilder({ companyId, repositoryId })
    delete process.env.UPFLOW_DATA_DIR

    const dataDir = path.join(__dirname, '..', 'data', 'json') // App's root directory
    expect(pathBuilder.jsonPath('test.json')).toStrictEqual(`${dataDir}/test-company/test-repository/test.json`)
  })

  test('jsonPath defined UPFLOW_DATA_DIR', () => {
    const companyId = 'test-company'
    const repositoryId = 'test-repository'
    const pathBuilder = createPathBuilder({ companyId, repositoryId })
    process.env.UPFLOW_DATA_DIR = '/'

    expect(pathBuilder.jsonPath('test.json')).toStrictEqual(`/json/test-company/test-repository/test.json`)
  })
})
