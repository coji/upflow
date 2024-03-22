import type { Kysely } from 'kysely'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const up = async (db: Kysely<any>) => {
  await db.schema
    .createTable('pull_requests')
    .addColumn('repo_id', 'varchar', (col) => col.notNull())
    .addColumn('id', 'integer', (col) => col.notNull())
    .addColumn('organization', 'text', (col) => col.notNull())
    .addColumn('repo', 'varchar', (col) => col.notNull())
    .addColumn('number', 'integer', (col) => col.notNull())
    .addColumn('state', 'varchar', (col) => col.notNull())
    .addColumn('title', 'varchar', (col) => col.notNull())
    .addColumn('url', 'varchar', (col) => col.notNull())
    .addColumn('author', 'varchar', (col) => col.notNull())
    .addColumn('assignees', 'json', (col) => col.notNull())
    .addColumn('reviewers', 'json', (col) => col.notNull())
    .addColumn('draft', 'boolean', (col) => col.notNull())
    .addColumn('source_branch', 'varchar', (col) => col.notNull())
    .addColumn('target_branch', 'varchar', (col) => col.notNull())
    .addColumn('merged_at', 'timestamp')
    .addColumn('merge_commit_sha', 'varchar')
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull())
    .addPrimaryKeyConstraint('pull_requests_pk', ['repo_id', 'id'])
    .execute()

  await db.schema
    .createTable('tags')
    .addColumn('repo_id', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('sha', 'varchar', (col) => col.notNull())
    .addColumn('committed_at', 'timestamp', (col) => col.notNull())
    .addPrimaryKeyConstraint('tags_pk', ['repo_id', 'name'])
    .execute()

  await db.schema
    .createTable('commits')
    .addColumn('repo_id', 'varchar', (col) => col.notNull())
    .addColumn('pull_request_id', 'integer', (col) => col.notNull())
    .addColumn('sha', 'varchar', (col) => col.notNull())
    .addColumn('url', 'varchar', (col) => col.notNull())
    .addColumn('committer', 'varchar')
    .addColumn('date', 'timestamp')
    .addPrimaryKeyConstraint('commits_pk', [
      'repo_id',
      'pull_request_id',
      'sha',
    ])
    .execute()

  await db.schema
    .createTable('issue_comments')
    .addColumn('repo_id', 'varchar', (col) => col.notNull())
    .addColumn('pull_request_id', 'integer', (col) => col.notNull())
    .addColumn('id', 'integer', (col) => col.notNull())
    .addColumn('user', 'varchar', (col) => col.notNull())
    .addColumn('url', 'varchar', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull())
    .addPrimaryKeyConstraint('issue_comments_pk', [
      'repo_id',
      'pull_request_id',
      'id',
    ])
    .execute()

  await db.schema
    .createTable('reviews')
    .addColumn('repo_id', 'varchar', (col) => col.notNull())
    .addColumn('pull_request_id', 'integer', (col) => col.notNull())
    .addColumn('id', 'integer', (col) => col.notNull())
    .addColumn('user', 'varchar')
    .addColumn('state', 'varchar', (col) => col.notNull())
    .addColumn('url', 'varchar', (col) => col.notNull())
    .addColumn('submitted_at', 'timestamp')
    .addPrimaryKeyConstraint('reviews_pk', ['repo_id', 'pull_request_id', 'id'])
    .execute()
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const down = async (db: Kysely<any>) => {
  await db.schema.dropTable('pull_requests').execute()
}
