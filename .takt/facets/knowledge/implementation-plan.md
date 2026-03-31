# Implementation Plan Context

## Source of Truth

- The task order (order.md) is the authoritative spec for the current task
- Do NOT modify order.md — if it seems incomplete, implement what's there
- Completion conditions in the task order are the acceptance criteria
- CLAUDE.md contains project conventions — follow them

## Project Validation

```bash
pnpm validate  # lint (Biome), format (Prettier), typecheck, build, test (Vitest)
```

When the task involves DB schema changes, also run:

```bash
pnpm db:setup  # Reset DB with migrations + seed data (verifies clean-slate migration)
```

## Database Migration Workflow

1. Edit declarative schema: `db/shared.sql` (shared DB) or `db/tenant.sql` (tenant DB)
2. Generate migration: `pnpm db:migrate`
3. Review the generated SQL — Atlas auto-generates it, but you must verify correctness
4. Apply migration: `pnpm db:apply`
5. Regenerate Kysely types: `pnpm db:generate` (outputs to `app/services/type.ts`)

## Key Conventions (from CLAUDE.md)

- **CamelCasePlugin**: `sql` template literals don't transform identifiers — use `sql.ref('tableName.columnName')`
- **DateTime**: Store as ISO 8601 with Z suffix; parse with `dayjs.utc(value)`; display with `.tz(timezone)`
- **Server files**: `.server.ts` suffix for server-only code
- **Form handling**: Conform + Zod with discriminated union schema + `ts-pattern`
- **Multi-tenant security**: Auth guard before parseWithZod; scope mutations to org
