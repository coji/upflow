import { defineConfig } from 'kysely-codegen'

export default defineConfig({
  camelCase: true,
  dialect: 'sqlite',
  url: './data/data.db',
  outFile: 'app/services/type.ts',
  excludePattern: '_prisma_migrations',
  overrides: {
    columns: {
      'members.role': '"owner" | "admin" | "member"',
      'users.role': '"admin" | "user"',
      'integrations.method': '"token" | "github_app"',
      'integrations.provider': '"github"',
      'github_app_links.app_repository_selection': '"all" | "selected"',
    },
  },
})
