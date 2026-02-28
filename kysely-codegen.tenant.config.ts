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
      'integrations.method': '"token"',
      'repositories.provider': '"github"',
      'organization_settings.release_detection_method':
        'Generated<"branch" | "tags">',
      'repositories.release_detection_method': 'Generated<"branch" | "tags">',
    },
  },
})
