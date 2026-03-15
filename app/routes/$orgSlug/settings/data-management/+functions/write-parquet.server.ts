import { ParquetSchema, ParquetWriter } from '@dsnp/parquetjs'
import type {
  ParquetCompression,
  ParquetType,
} from '@dsnp/parquetjs/dist/lib/declare'
import type { ExportRow } from './build-export-data.server'

const COMPRESSION: ParquetCompression = 'GZIP'
const ROW_GROUP_SIZE = 1000

/**
 * Helper to define a Parquet field with default compression.
 */
function f(type: ParquetType, optional = false) {
  return { type, optional, compression: COMPRESSION }
}

const BASE_FIELDS = {
  repo: f('UTF8'),
  number: f('INT32'),
  title: f('UTF8'),
  url: f('UTF8'),
  state: f('UTF8'),
  author: f('UTF8'),
  source_branch: f('UTF8'),
  target_branch: f('UTF8'),
  first_committed_at: f('UTF8', true),
  pull_request_created_at: f('UTF8'),
  first_reviewed_at: f('UTF8', true),
  merged_at: f('UTF8', true),
  released_at: f('UTF8', true),
  coding_time: f('DOUBLE', true),
  pickup_time: f('DOUBLE', true),
  review_time: f('DOUBLE', true),
  deploy_time: f('DOUBLE', true),
  total_time: f('DOUBLE', true),
  additions: f('INT32', true),
  deletions: f('INT32', true),
  changed_files: f('INT32', true),
  complexity: f('UTF8', true),
  complexity_reason: f('UTF8', true),
  corrected_complexity: f('UTF8', true),
  author_display_name: f('UTF8', true),
  author_is_active: f('BOOLEAN', true),
  team_name: f('UTF8', true),
  reviewers: f('UTF8'),
}

const RAW_FIELDS = {
  raw_pull_request: f('UTF8', true),
  raw_commits: f('UTF8', true),
  raw_reviews: f('UTF8', true),
  raw_discussions: f('UTF8', true),
  raw_timeline_items: f('UTF8', true),
}

/**
 * Convert a SQLite row to a Parquet-compatible row.
 * - SQLite stores booleans as 0/1 integers; Parquet expects true/false.
 */
function toParquetRow(row: ExportRow): Record<string, unknown> {
  return {
    ...row,
    author_is_active:
      row.author_is_active == null ? null : row.author_is_active === 1,
  }
}

/**
 * Stream rows from an iterator into a Parquet file on disk.
 *
 * Memory usage is bounded by ROW_GROUP_SIZE × row size.
 * The writer flushes each row group to disk before buffering the next.
 */
export async function writeParquetFile(
  rows: IterableIterator<ExportRow>,
  outputPath: string,
  options: { includeRaw?: boolean } = {},
): Promise<void> {
  const fields = options.includeRaw
    ? { ...BASE_FIELDS, ...RAW_FIELDS }
    : BASE_FIELDS
  const schema = new ParquetSchema(fields)

  const writer = await ParquetWriter.openFile(schema, outputPath, {
    rowGroupSize: ROW_GROUP_SIZE,
  })

  for (const row of rows) {
    await writer.appendRow(toParquetRow(row))
  }

  await writer.close()
}
