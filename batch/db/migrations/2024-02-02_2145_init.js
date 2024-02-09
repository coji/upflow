import { Kysely, sql } from 'kysely'

export const up = async (db) => {
  await db.schema
    .createTable('pull_requests')
    .addColumn('id', 'integer', (col) => col.notNull())
    .addColumn('organization', 'text', (col) => col.notNull())
    .addColumn('repo', 'text', (col) => col.notNull())
    .addColumn('number', 'integer', (col) => col.notNull())
    .addColumn('state', 'text', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('author', 'text', (col) => col.notNull())
    .addColumn('assignees', 'json', (col) => col.notNull())
    .addColumn('reviewers', 'json', (col) => col.notNull())
    .addColumn('draft', 'boolean', (col) => col.notNull())
    .addColumn('source_branch', 'text', (col) => col.notNull())
    .addColumn('target_branch', 'text', (col) => col.notNull())
    .addColumn('merged_at', 'timestamp')
    .addColumn('merge_commit_sha', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addPrimaryKeyConstraint('pull_requests_pk', ['id'])
    .execute()

  await db.schema
    .createTable('commits')
    .addColumn('sha', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('committer', 'text', (col) => col.notNull())
    .addColumn('date', 'timestamp', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('pull_request_commits')
    .addColumn('organization', 'text', (col) => col.notNull())
    .addColumn('repo', 'text', (col) => col.notNull())
    .addColumn('number', 'integer', (col) => col.notNull())
    .addColumn('sha', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('pull_request_commits_pk', [
      'organization',
      'repo',
      'number',
      'sha',
    ])
    .execute()

  await db.schema
    .createTable('issue_comments')
    .addColumn('id', 'integer', (col) => col.notNull())
    .addColumn('user', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .execute()
}

export const down = async (db) => {
  await db.schema.dropTable('pull_requests').execute()
}
