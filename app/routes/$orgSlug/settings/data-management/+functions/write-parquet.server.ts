import type {
  ParquetCompression,
  ParquetType,
} from '@dsnp/parquetjs/dist/lib/declare'
import { ParquetSchema } from '@dsnp/parquetjs/dist/lib/schema'
import { ParquetWriter } from '@dsnp/parquetjs/dist/lib/writer'
import type { ExportRow } from './build-export-data.server'

const COMPRESSION: ParquetCompression = 'GZIP'
const ROW_GROUP_SIZE = 1000

/**
 * Helper to define a Parquet field with default compression.
 */
function field(type: ParquetType, optional = false) {
  return { type, optional, compression: COMPRESSION }
}

const BASE_FIELDS = {
  repo: field('UTF8'),
  number: field('INT32'),
  title: field('UTF8'),
  url: field('UTF8'),
  state: field('UTF8'),
  author: field('UTF8'),
  source_branch: field('UTF8'),
  target_branch: field('UTF8'),
  first_committed_at: field('UTF8', true),
  pull_request_created_at: field('UTF8'),
  first_reviewed_at: field('UTF8', true),
  merged_at: field('UTF8', true),
  closed_at: field('UTF8', true),
  released_at: field('UTF8', true),
  coding_time: field('DOUBLE', true),
  pickup_time: field('DOUBLE', true),
  review_time: field('DOUBLE', true),
  deploy_time: field('DOUBLE', true),
  total_time: field('DOUBLE', true),
  additions: field('INT32', true),
  deletions: field('INT32', true),
  changed_files: field('INT32', true),
  complexity: field('UTF8', true),
  complexity_reason: field('UTF8', true),
  corrected_complexity: field('UTF8', true),
  author_display_name: field('UTF8', true),
  author_is_active: field('BOOLEAN', true),
  team_name: field('UTF8', true),
  reviewers: field('UTF8'),
}

const RAW_FIELDS = {
  raw_pull_request: field('UTF8', true),
  raw_commits: field('UTF8', true),
  raw_reviews: field('UTF8', true),
  raw_discussions: field('UTF8', true),
  raw_timeline_items: field('UTF8', true),
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

  try {
    for (const row of rows) {
      await writer.appendRow(toParquetRow(row))
    }
  } finally {
    await writer.close()
  }
}
