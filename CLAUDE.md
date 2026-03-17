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
- **Auth**: better-auth with GitHub OAuth, supporting organizations
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
├── libs/                  # Shared utilities
│   ├── auth.server.ts     # better-auth + org membership guards
│   └── reserved-slugs.ts  # Reserved URL slugs
├── services/              # Server-side services
│   ├── db.server.ts                   # Kysely database client
│   ├── tenant-db.server.ts            # Per-org tenant database
│   ├── github-linking.server.ts       # GitHub login auto-linking to companyGithubUsers
│   └── type.ts                        # Generated Kysely types (from kysely-codegen)
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

- `index.tsx` - Page component (leaf route). `_index.tsx` is an alias
- `_layout.tsx` - Layout wrapper (renders `<Outlet>`, groups child routes)
- `$param` - Dynamic segments
- `_` prefix on folders - Pathless layout group (e.g. `_auth/` → no `/auth` segment)
- `+` prefix - Co-located files, not routes (e.g. `+components/`, `+functions/`)

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

**マイグレーション作成時の注意**: Atlas が自動生成した SQL は必ずレビューする。`DROP TABLE` は `IF EXISTS` を付ける。destructive な操作は本番 DB 相当の状態でテストしてからデプロイする。

**CamelCasePlugin と `sql` テンプレート**: `sql` テンプレートリテラル内の識別子は CamelCasePlugin で変換されない。`sql` 内でカラムを参照するときは `sql.ref('tableName.columnName')` を使うこと。

### 日時・タイムゾーンの原則

- **DB 保存形式**: ISO 8601（`2026-03-16T02:56:35Z`）。Z付きで保存し、ローカルタイム形式（`2026-03-16 02:56:35`）は使わない
- **DB から読んだ日時のパース**: 必ず `dayjs.utc(value)` を使う。`dayjs(value)` はローカルタイムとして解釈されるため、タイムゾーン変換が正しく動かない
- **表示層でのタイムゾーン変換**: `dayjs.utc(value).tz(timezone)` のパターンを使う
- **batch での書き込み**: GitHub API から取得した ISO 8601 文字列をそのまま DB に保存する。独自のフォーマット変換をかけない
- **`timeFormatTz`**（`batch/helper/timeformat.ts`）: レポートやスプレッドシート出力用。内部で `dayjs.utc()` を使用済み

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

- **Within a form field** (label + input + error): `space-y-1`
- **Between form fields**: `<Stack>` default gap (`gap-2`)
- **Between page sections**: `<Stack gap="6">`
- **Within a section** (title + description): `space-y-1`

### Batch Processing

CLI for data synchronization (`batch/cli.ts`):

- `fetch` - Fetches PR data from GitHub API → raw データ保存
- `backfill` - PR メタデータだけ再取得して raw データを更新（軽量）
- `upsert` - raw データ → DB 変換（API call なし）
- `report` - Generates cycle time reports

In production, `fetch` → `upsert` が定期実行される（`job-scheduler.ts`）。

#### 開発時のデータ管理

マイグレーションで新カラムを追加した後のローカル DB 更新手順:

```bash
# 本番 DB を取得してスキーマ更新
pnpm ops pull-db -- --app <fly-app>
pnpm db:apply

# 新カラムを埋める（ほとんどのケースはこれで十分）
pnpm tsx batch/cli.ts backfill <org-id>
pnpm tsx batch/cli.ts upsert <org-id>
```

| ケース                                | コマンド              | API call   | 所要時間    |
| ------------------------------------- | --------------------- | ---------- | ----------- |
| raw にあるデータの新カラム            | `upsert` のみ         | なし       | 数分        |
| PR メタデータの新フィールド           | `backfill` → `upsert` | PR一覧のみ | 数十秒+数分 |
| 詳細データ（commits等）の新フィールド | `fetch --refresh`     | 全PR×5 API | 30分〜      |

`fetch --refresh` はほぼ不要。`backfill` + `upsert` で済むケースがほとんど。

### Multi-Tenant Security

All org-scoped routes live under `app/routes/$orgSlug/`. Key rules:

- **Auth guard first**: Call `requireOrgMember` or `requireOrgAdmin` BEFORE `parseWithZod(request.formData())` — unauthenticated users must not receive validation errors
- **No user-controlled IDs in conflict keys**: `onConflict` must use server-derived keys (e.g. `organizationId`), never IDs from form hidden inputs
- **Mutation functions must scope to org**: Every UPDATE/DELETE on org-scoped tables must include `WHERE organizationId = ?` with a server-derived value
- **Route-layer ownership check for child resources**: When operating on a resource by ID (repository, member), verify `resource.organizationId === organization.id` before any mutation

Org-scoped tables (have `organizationId` column): `companyGithubUsers`, `exportSettings`, `integrations`, `invitations`, `members`, `organizationSettings`, `repositories`, `teams`

**Org scoping in queries**: There is no automatic plugin for org scoping. Every UPDATE/DELETE on org-scoped tables must manually include `WHERE organizationId = ?` with a server-derived value. Tenant-specific data lives in per-org SQLite databases accessed via `getTenantDb(organizationId)`.

### Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details. See `opensrc/sources.json` for the list of available packages and their versions. Use this source code when you need to understand how a package works internally, not just its types/interface.

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

### LLM プロンプト作成・編集

LLM に投げるプロンプト（system instruction 等）を作成・編集する際は、必ず `docs/guides/gemini-prompting.md` を確認し、ベストプラクティスに従うこと。

### PR前チェックリスト

1. `pnpm validate` が通る（lint, format, typecheck, build, test）
2. スキーマ変更時: `pnpm db:setup` が通る
3. マイグレーション: 本番DBの既存データで安全に適用できる
4. 追加・変更したロジックにユニットテストがある
5. 凝集度が高いか: 関数・モジュールが単一の責務に集中しているか。複数の関心事が混在していたら分割する
6. 結合度が低いか: 依存を引数で受け取れるようにしてテスト可能にする。ロジックの重複は共通化する
