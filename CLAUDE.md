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
pnpm setup

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

```
app/
├── routes/           # File-based routing (remix-flat-routes convention)
│   ├── _dashboard+/  # Dashboard views (authenticated)
│   ├── admin+/       # Admin/settings views
│   ├── _auth+/       # Authentication routes
│   └── api.auth.$/   # Auth API endpoints
├── services/         # Server-side services
│   ├── db.server.ts  # Kysely database client
│   └── type.ts       # Generated Kysely types (from kysely-codegen)
├── libs/             # Shared utilities
│   └── auth.server.ts    # better-auth configuration
├── components/       # React components
│   └── ui/           # shadcn/ui components
└── hooks/            # Custom React hooks

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

Uses `remix-flat-routes` with the `+` folder syntax:

- `_layout.tsx` - Layout routes (no URL segment)
- `_index.tsx` - Index routes
- `$param` - Dynamic segments
- `$organization.settings/` - Nested route folders

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

Use `~/` prefix for imports from project root:

```typescript
import { db } from '~/app/services/db.server'
import { Button } from '~/app/components/ui/button'
```

### Batch Processing

CLI for data synchronization (`batch/cli.ts`):

- `fetch` - Fetches PR data from GitHub
- `report` - Generates cycle time reports
- `upsert` - Updates database with processed data

In production, these run on a schedule via `job-schedular.ts`.
