import { defineConfig } from 'kysely-codegen'

export default defineConfig({
  camelCase: true,
  dialect: 'sqlite',
  url: './data/data.db',
  outFile: 'app/services/type.ts',
  overrides: {
    columns: {
      'members.role': '"owner" | "admin" | "member"',
      'users.role': '"admin" | "user"',
    },
  },
})
