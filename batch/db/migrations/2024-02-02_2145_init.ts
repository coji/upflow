import { Kysely, sql } from 'kysely'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const up = async (db: Kysely<any>) => {
  await db.schema
    .createTable('pull_requests')
    .addColumn('organization', 'text', (col) => col.notNull())
    .addColumn('repo', 'text', (col) => col.notNull())
    .addColumn('number', 'integer', (col) => col.notNull())
    .addColumn('state', 'text', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('author', 'text', (col) => col.notNull())
    .addColumn('source_branch', 'text', (col) => col.notNull())
    .addColumn('target_branch', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addColumn('merged_at', 'timestamp')
    .addColumn('merge_commit_sha', 'text')
    .addPrimaryKeyConstraint('pull_requests_pk', [
      'organization',
      'repo',
      'number',
    ])
    .execute()
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const down = async (db: Kysely<any>) => {
  await db.schema.dropTable('pull_requests').execute()
}
