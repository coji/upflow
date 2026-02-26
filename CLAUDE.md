# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Upflow is a development productivity dashboard that tracks pull request cycle times from GitHub. It calculates metrics like coding time, pickup time, review time, and deploy time to help teams understand their development workflow.

## Development Commands

```bash
# Start dev server (React Router with HMR)
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start

# Run tests
pnpm test

# Run a single test file
pnpm vitest run <path/to/test.ts>

# Type checking
pnpm typecheck

# Linting (Biome)
pnpm lint

# Format check (Prettier)
pnpm format

# Format fix
pnpm format:fix

# Full validation pipeline
pnpm validate

# Database reset with seed data
pnpm db:setup

# E2E tests
pnpm test:e2e
```

## Architecture

### Tech Stack

- **Framework**: React Router v7 (SSR mode) with Express server
- **Database**: SQLite via Atlas (migrations) and Kysely (query builder, type generation)
- **Auth**: better-auth with Google OAuth, supporting organizations
- **UI**: shadcn/ui components (new-york style) with Tailwind CSS v4
- **Testing**: Vitest (unit), Playwright (E2E)
- **Linting**: Biome (lint), Prettier (format)

### Project Structure

```text
app/
├── routes/                # File-based routing (react-router-auto-routes)
│   ├── $orgSlug/          # Org-scoped routes (dashboard, settings)
│   ├── admin/             # Superadmin routes (org list, create)
│   ├── _auth/             # Authentication routes (login, logout)
│   ├── resources/         # Resource routes (org switcher data)
│   └── api.auth.$.ts      # Auth API endpoint
├── services/              # Server-side services
│   ├── db.server.ts                   # Kysely database client
│   ├── organization-scope-plugin.ts   # Kysely plugin for org scoping
│   └── type.ts                        # Generated Kysely types (from kysely-codegen)
├── libs/                  # Shared utilities
│   ├── auth.server.ts     # better-auth + org membership guards
│   └── reserved-slugs.ts  # Reserved URL slugs
├── components/            # React components
│   └── ui/                # shadcn/ui components
└── hooks/                 # Custom React hooks

batch/                # CLI batch jobs for data processing
├── cli.ts            # Main CLI entry (cleye)
├── commands/         # CLI commands (fetch, report, upsert)
├── jobs/             # Scheduled job definitions
└── provider/         # GitHub API integration

db/
├── schema.sql        # Declarative schema (Atlas source)
├── migrations/       # Atlas versioned migrations
└── seed.ts           # Seed data
```

### Routing Convention

Uses `react-router-auto-routes` for file-based routing (`export default autoRoutes() satisfies RouteConfig`):

- `_layout.tsx` - Layout routes (no URL segment)
- `_index.tsx` - Index routes
- `$param` - Dynamic segments
- `+` prefix - Co-located files (not routes, e.g. `+components/`, `+hooks/`, `+functions/`)

### Database Pattern

Atlas + Kysely setup:

- **Atlas**: Schema management and versioned SQL migrations
- **Kysely**: Runtime queries and type generation via kysely-codegen

```bash
# Generate new migration from schema.sql changes
pnpm db:migrate

# Apply migrations to local database
pnpm db:apply

# Generate Kysely types from database
pnpm db:generate
```

Types are generated to `app/services/type.ts` from the database.

### Path Aliases

Use `~/` prefix for imports from `app/` directory:

```typescript
import { db } from '~/app/services/db.server'
import { Button } from '~/app/components/ui/button'
```

### Server-Side Code Convention

Files with `.server.ts` suffix are server-only and won't be bundled for the client:

- `queries.server.ts` - Database read operations
- `mutations.server.ts` - Database write operations
- `functions.server.ts` - General server utilities
- `*.action.server.ts` - Form action handlers

### Form Handling

Uses Conform with Zod for type-safe form validation:

```typescript
import { parseWithZod } from '@conform-to/zod/v4'
import { zx } from '@coji/zodix/v4'
```

Routes with multiple form actions use intent-based dispatch with `ts-pattern`:

```typescript
const { intent } = await zx.parseForm(formData, { intent: intentsSchema })
return match(intent)
  .with(INTENTS.save, () => saveAction(...))
  .with(INTENTS.delete, () => deleteAction(...))
  .exhaustive()
```

### UI Spacing Rules

Consistent spacing patterns used throughout the app:

| Context | Pattern | Gap |
| --- | --- | --- |
| Within a form field (label + input + error) | `<fieldset className="space-y-1">` | 0.25rem |
| Between form fields | `<Stack>` (default gap) | 0.5rem (gap-2) |
| Between page sections | `<Stack gap="6">` | 1.5rem |
| Within a section (title + description) | `<div className="space-y-1">` | 0.25rem |

```tsx
{/* Form field pattern */}
<fieldset className="space-y-1">
  <Label htmlFor={field.id}>Label</Label>
  <Input {...getInputProps(field, { type: 'text' })} />
  <div className="text-destructive">{field.errors}</div>
</fieldset>
```

### Batch Processing

CLI for data synchronization (`batch/cli.ts`):

- `fetch` - Fetches PR data from GitHub
- `report` - Generates cycle time reports
- `upsert` - Updates database with processed data

In production, these run on a schedule via `job-schedular.ts`.

### Multi-Tenant Security

All org-scoped routes live under `app/routes/$orgSlug/`. Key rules:

- **Auth guard first**: Call `requireOrgMember` or `requireOrgAdmin` BEFORE `parseWithZod(request.formData())` — unauthenticated users must not receive validation errors
- **No user-controlled IDs in conflict keys**: `onConflict` must use server-derived keys (e.g. `organizationId`), never IDs from form hidden inputs
- **Mutation functions must scope to org**: Every UPDATE/DELETE on org-scoped tables must include `WHERE organizationId = ?` with a server-derived value
- **Route-layer ownership check for child resources**: When operating on a resource by ID (repository, member), verify `resource.organizationId === organization.id` before any mutation

Org-scoped tables (have `organizationId` column): `companyGithubUsers`, `exportSettings`, `integrations`, `invitations`, `members`, `organizationSettings`, `repositories`, `teams`

**OrganizationScopePlugin** (`app/services/organization-scope-plugin.ts`): Kysely plugin that auto-injects `WHERE organization_id = ?` into SELECT/UPDATE/DELETE on scoped tables. Use for defense-in-depth:

```typescript
import { db, OrganizationScopePlugin } from '~/app/services/db.server'
const scopedDb = db.withPlugin(new OrganizationScopePlugin(organization.id))
```

### Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details. See `opensrc/sources.json` for the list of available packages.

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```
