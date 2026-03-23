# UpFlow

Development productivity dashboard that tracks pull request cycle times from GitHub. Calculates coding time, pickup time, review time, and deploy time to help teams understand their development workflow.

Data is stored in SQLite with a multi-tenant (database-per-org) architecture.

## Setup

### Prerequisites

- Node.js 22+
- pnpm

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable                    | Description                                        | Required |
| --------------------------- | -------------------------------------------------- | -------- |
| `DATABASE_URL`              | SQLite database path (e.g. `file:../data/data.db`) | Yes      |
| `BETTER_AUTH_SECRET`        | Secret for better-auth (min 32 chars)              | Yes      |
| `BETTER_AUTH_URL`           | App URL (e.g. `http://localhost:5173`)             | Yes      |
| `GITHUB_CLIENT_ID`          | GitHub App client ID                               | Yes      |
| `GITHUB_CLIENT_SECRET`      | GitHub App client secret                           | Yes      |
| `INTEGRATION_PRIVATE_TOKEN` | GitHub PAT for PR data fetching                    | Yes      |
| `GEMINI_API_KEY`            | Gemini API key for PR classification               | No       |

### 3. Set up GitHub App

Create a GitHub App at https://github.com/settings/apps/new:

- **Callback URL**: `http://localhost:5173/api/auth/callback/github` (dev) / `https://your-domain/api/auth/callback/github` (prod)
- **Expire user authorization tokens**: ON
- **Request user authorization (OAuth) during installation**: ON
- **Webhook**: Active OFF
- **Permissions > Account permissions > Email addresses**: Read-only

Use the **Client ID** and generate a **Client secret** for your `.env`.

### 4. Initialize database

```bash
pnpm db:setup
```

### 5. Start development server

```bash
pnpm dev
```

## Fetching PR Data

UpFlow needs to fetch PR data from GitHub to display metrics. After setting up a repository in the dashboard, run:

```bash
pnpm tsx batch/cli.ts crawl <org-id>
```

In production, `crawl` runs automatically every hour.

## Authentication

- **GitHub OAuth only**: Login requires the user's GitHub login to be registered in the org's GitHub Users list with Active status
- **First-user bootstrap**: On a fresh database with no users, the first GitHub login is allowed unconditionally and promoted to super admin
- **Auto-registration**: PR authors and reviewers are automatically added as inactive GitHub users during crawl. An admin enables them via Settings > GitHub Users

## License

[O'Saasy License](./LICENSE) — 自由に使用・改変・配布できますが、本ソフトウェアの機能そのものを主たる価値とする競合 SaaS の提供は禁止されています。
