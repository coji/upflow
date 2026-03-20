import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import type { ExportRow } from './build-export-data.server'
import { writeParquetFile } from './write-parquet.server'

function makeRow(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    repo: 'owner/repo',
    number: 1,
    title: 'Fix bug',
    url: 'https://github.com/owner/repo/pull/1',
    state: 'merged',
    author: 'alice',
    source_branch: 'fix/bug',
    target_branch: 'main',
    first_committed_at: '2024-01-10T00:00:00Z',
    pull_request_created_at: '2024-01-11T00:00:00Z',
    first_reviewed_at: '2024-01-12T00:00:00Z',
    merged_at: '2024-01-13T00:00:00Z',
    closed_at: '2024-01-13T00:00:00Z',
    released_at: null,
    coding_time: 1.0,
    pickup_time: 1.0,
    review_time: 1.0,
    deploy_time: null,
    total_time: null,
    additions: 10,
    deletions: 5,
    changed_files: 2,
    complexity: 'simple',
    complexity_reason: 'Small change',
    corrected_complexity: null,
    author_display_name: 'Alice',
    author_is_active: 1,
    author_is_bot: 0,
    team_name: 'Backend',
    reviewers: JSON.stringify([
      {
        login: 'bob',
        display_name: 'Bob',
        requested_at: null,
        reviewed_at: '2024-01-12T00:00:00Z',
        state: 'APPROVED',
      },
    ]),
    ...overrides,
  }
}

/** Parquet files start with magic bytes "PAR1" */
const PARQUET_MAGIC = Buffer.from('PAR1')

const tmpFiles: string[] = []
function tmpParquetPath() {
  const p = join(
    tmpdir(),
    `test-parquet-${Date.now()}-${Math.random()}.parquet`,
  )
  tmpFiles.push(p)
  return p
}

afterEach(() => {
  for (const f of tmpFiles) {
    try {
      unlinkSync(f)
    } catch {}
  }
  tmpFiles.length = 0
})

describe('writeParquetFile', () => {
  test('writes a valid Parquet file', async () => {
    const outputPath = tmpParquetPath()
    const rows = [makeRow(), makeRow({ number: 2, title: 'Add feature' })]

    await writeParquetFile(rows.values(), outputPath)

    const buf = readFileSync(outputPath)
    // Parquet magic at start and end of file
    expect(buf.subarray(0, 4).equals(PARQUET_MAGIC)).toBe(true)
    expect(buf.subarray(buf.length - 4).equals(PARQUET_MAGIC)).toBe(true)
    // File should have meaningful content (> 100 bytes)
    expect(buf.length).toBeGreaterThan(100)
  })

  test('writes larger file with includeRaw', async () => {
    const outputPath = tmpParquetPath()
    const baseOutputPath = tmpParquetPath()

    const baseRow = makeRow()
    const rawRow = makeRow({
      raw_pull_request: '{"id": 123, "body": "long content here"}',
      raw_commits: '[{"sha": "abc123"}]',
      raw_reviews: '[]',
      raw_discussions: null,
      raw_timeline_items: null,
    })

    await writeParquetFile([baseRow].values(), baseOutputPath)
    await writeParquetFile([rawRow].values(), outputPath, { includeRaw: true })

    const baseSize = readFileSync(baseOutputPath).length
    const rawSize = readFileSync(outputPath).length

    // Raw version should be larger (has more columns)
    expect(rawSize).toBeGreaterThan(baseSize)
  })

  test('handles empty iterator', async () => {
    const outputPath = tmpParquetPath()
    const emptyIterator: IterableIterator<ExportRow> = [][Symbol.iterator]()

    await writeParquetFile(emptyIterator, outputPath)

    const buf = readFileSync(outputPath)
    expect(buf.subarray(0, 4).equals(PARQUET_MAGIC)).toBe(true)
  })

  test('handles null values in optional fields', async () => {
    const outputPath = tmpParquetPath()
    const rows = [
      makeRow({
        first_committed_at: null,
        merged_at: null,
        coding_time: null,
        additions: null,
        complexity: null,
        author_display_name: null,
        author_is_active: null,
        team_name: null,
      }),
    ]

    await writeParquetFile(rows.values(), outputPath)

    const buf = readFileSync(outputPath)
    expect(buf.subarray(0, 4).equals(PARQUET_MAGIC)).toBe(true)
  })
})
