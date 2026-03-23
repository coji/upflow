import { defineConfig } from 'kysely-codegen'

export default defineConfig({
  camelCase: true,
  dialect: 'sqlite',
  url: './data/tenant_seed.db',
  outFile: 'app/services/tenant-type.ts',
  overrides: {
    columns: {
      'company_github_users.is_active': '0 | 1',
      'organization_settings.is_active': 'Generated<0 | 1>',
      'pull_requests.state': '"open" | "closed" | "merged"',
      'pull_request_reviews.state':
        '"APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED"',
      'integrations.provider': '"github"',
      'integrations.method': '"token" | "github_app"',
      'repositories.provider': '"github"',
      'organization_settings.language': 'Generated<"en" | "ja">',
      'organization_settings.release_detection_method':
        'Generated<"branch" | "tags">',
      'repositories.release_detection_method': 'Generated<"branch" | "tags">',
      'github_raw_data.pull_request': 'ColumnType<unknown, string, string>',
      'github_raw_data.commits': 'ColumnType<unknown, string, string>',
      'github_raw_data.reviews': 'ColumnType<unknown, string, string>',
      'github_raw_data.discussions': 'ColumnType<unknown, string, string>',
      'github_raw_tags.tags': 'ColumnType<unknown, string, string>',
    },
  },
})
