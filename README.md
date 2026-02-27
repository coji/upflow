# UpFlow

Development productivity dashboard that tracks pull request cycle times from GitHub. Calculates coding time, pickup time, review time, and deploy time to help teams understand their development workflow.

## Tech Stack

- **Framework**: React Router v7 (SSR) + Express
- **Database**: SQLite (multi-tenant, database-per-org) via Atlas + Kysely
- **Auth**: better-auth with Google & GitHub OAuth
- **UI**: shadcn/ui + Tailwind CSS v4
- **Testing**: Vitest + Playwright
- **Hosting**: Fly.io

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

| Variable                    | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `DATABASE_URL`              | SQLite database path (e.g. `file:../data/data.db`) |
| `SESSION_SECRET`            | Secret for session encryption                      |
| `BETTER_AUTH_SECRET`        | Secret for better-auth                             |
| `BETTER_AUTH_URL`           | App URL (e.g. `http://localhost:5173`)             |
| `GOOGLE_CLIENT_ID`          | Google OAuth client ID                             |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth client secret                         |
| `GITHUB_CLIENT_ID`          | GitHub App client ID                               |
| `GITHUB_CLIENT_SECRET`      | GitHub App client secret                           |
| `INTEGRATION_PRIVATE_TOKEN` | GitHub PAT for PR data fetching                    |
| `GEMINI_API_KEY`            | Gemini API key for AI features                     |

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

## Commands

```bash
pnpm dev          # Start dev server with HMR
pnpm build        # Build for production
pnpm start        # Run production server
pnpm test         # Run unit tests
pnpm test:e2e     # Run E2E tests
pnpm typecheck    # Type checking
pnpm lint         # Lint (Biome)
pnpm format       # Format check (Prettier)
pnpm validate     # Full validation pipeline
pnpm db:setup     # Reset database with seed data
pnpm db:migrate   # Generate migration from schema changes
pnpm db:apply     # Apply migrations
pnpm db:generate  # Generate Kysely types
```

## Authentication

- **Google OAuth**: Restricted by Google Workspace (internal users only)
- **GitHub OAuth**: Restricted to users registered in `companyGithubUsers` (managed in Settings > GitHub Users)
- Same-email accounts are automatically linked across providers

## License

Private
