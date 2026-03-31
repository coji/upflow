# Step Implementation Policy

## Scope Rules

- Only implement what the current step specifies
- Do NOT implement anything from future steps
- Do NOT modify the implementation plan (PLAN.md, RFC, design docs)
- Do NOT modify the task order (order.md) — it is the authoritative spec
- Changes to files outside the listed change targets are allowed ONLY if
  the step's changes cause compilation or test failures in those files

## Quality Rules

- Run the project's validation command before declaring completion
- Follow existing code patterns and conventions (refer to CLAUDE.md)
- Keep changes minimal — no drive-by refactoring

## Database Migration Rules

When the task involves DB schema changes:

- Edit the declarative schema (`db/shared.sql` or `db/tenant.sql`) first
- Run `pnpm db:migrate` to generate migration SQL, then review it carefully
- Atlas auto-generated SQL must be reviewed: add `IF EXISTS` to manually added `DROP TABLE` statements
- Run `pnpm db:apply` to apply the migration
- Run `pnpm db:generate` to regenerate Kysely types (`app/services/type.ts`)
- Destructive operations must be tested against production-equivalent data before deploying

## Prohibited Actions

- Modifying spec/plan/RFC files
- Modifying the task order (order.md)
- Adding features not specified in the step
- Changing test infrastructure unless the step requires it
