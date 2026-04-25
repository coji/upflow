# UpFlow

Tracks pull request cycle times from GitHub — coding, pickup, review, and deploy — so teams can see where time is spent and ship faster.

Data is stored in SQLite with a multi-tenant (database-per-org) architecture.

## Setup

### Prerequisites

- Node.js 22+
- pnpm

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a GitHub App

UpFlow uses a GitHub App for OAuth login. This is required regardless of which integration method you choose below.

Create a GitHub App at https://github.com/settings/apps/new:

- **Callback URL**: `http://localhost:5173/api/auth/callback/github` (dev) / `https://your-domain/api/auth/callback/github` (prod)
- **Expire user authorization tokens**: ON
- **Request user authorization (OAuth) during installation**: ON
- **Permissions > Account permissions > Email addresses**: Read-only

Then copy `.env.example` and fill in the values:

```bash
cp .env.example .env
```

| Variable               | Description                            |
| ---------------------- | -------------------------------------- |
| `UPFLOW_DATA_DIR`      | Data directory path (e.g. `./data`)    |
| `BETTER_AUTH_SECRET`   | Secret for better-auth (min 32 chars)  |
| `BETTER_AUTH_URL`      | App URL (e.g. `http://localhost:5173`) |
| `GITHUB_CLIENT_ID`     | GitHub App client ID                   |
| `GITHUB_CLIENT_SECRET` | GitHub App client secret               |

### 3. Choose integration method

UpFlow supports two ways to fetch PR data from GitHub.

#### Method A: PAT (Personal Access Token) — simple self-hosted setup

The quickest way to get started on a single server. Just add a GitHub PAT to `.env`:

| Variable                    | Description                     |
| --------------------------- | ------------------------------- |
| `INTEGRATION_PRIVATE_TOKEN` | GitHub PAT for PR data fetching |

PR data is fetched by an hourly crawl job. For the initial fetch, see [Fetching PR Data](#fetching-pr-data) below.

#### Method B: GitHub App — organization-wide with realtime updates

For multi-team rollouts where PR data should update instantly on events. This uses the same GitHub App created in Step 2, with additional permissions and configuration.

##### Add repository permissions

In your GitHub App settings, add the following repository permissions:

- **Contents**: Read-only (commits)
- **Pull requests**: Read-only (PRs, reviews, comments)
- **Deployments**: Read-only (deploy events for cycle time calculation)
- **Metadata**: Read-only (automatically granted)

##### Additional environment variables

Add to `.env`:

| Variable                 | Description                             |
| ------------------------ | --------------------------------------- |
| `GITHUB_APP_ID`          | GitHub App ID                           |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (base64 encoded) |
| `GITHUB_WEBHOOK_SECRET`  | Webhook signature verification secret   |

The private key should be base64-encoded from the PEM file (required for platforms like Fly.io where newlines in env vars are problematic).

##### Install the App to your Organization

1. Log in to UpFlow and go to **Settings > Integration**
2. Switch the integration method to **GitHub App**
3. Click **Install GitHub App** — you'll be redirected to GitHub's installation page
4. Select the target Organization and configure repository access (All / Selected)
5. You'll be redirected back to UpFlow once installation is complete

You can verify the connection status in Settings > Integration.

##### Configure Webhook

Set up the webhook to enable realtime PR data updates.

1. In your GitHub App settings, set **Webhook** to Active
2. **Webhook URL**: `https://your-domain/api/github/webhook`
3. Generate a **Webhook Secret** and set the same value in both GitHub App settings and `GITHUB_WEBHOOK_SECRET` in `.env`
4. Under **Subscribe to events**, enable:
   - **Pull request** — triggers realtime crawl on PR changes
   - **Pull request review** — captures review events
   - **Pull request review comment** — captures review comments

### 4. Initialize database

```bash
pnpm db:setup
```

### 5. Start development server

```bash
pnpm dev
```

## GitHub API Emulator

For local development and smoke tests, UpFlow can point GitHub REST API and
Octokit calls at the [`emulate`](https://github.com/vercel-labs/emulate) GitHub
emulator instead of the real GitHub API.

Start the emulator in one terminal:

```bash
pnpm emulate:github
```

Then set `GITHUB_API_BASE_URL=http://localhost:4000` when running the app or
tests. `.env.emulate.example` contains the matching local values:

```bash
cp .env.emulate.example .env
pnpm dev
```

The seeded token `test_token_user1` maps to the seeded GitHub user `octocat`.
To verify the local emulator wiring:

```bash
pnpm test:emulate:github
```

This smoke test exercises the repository owner lookup, repository search, and
Octokit authenticated user call against the emulator. GitHub OAuth authorize and
token exchange still use the configured GitHub OAuth provider; only GitHub REST
API calls are redirected.

## Fetching PR Data

UpFlow needs to fetch PR data from GitHub to display metrics. After adding a repository in the dashboard, run:

```bash
pnpm tsx batch/cli.ts crawl <org-id>
```

In production, `crawl` runs automatically every hour. With Method B (GitHub App + Webhook), data also updates in realtime on PR events.

## Authentication

- **GitHub OAuth only**: login requires the user's GitHub login to be registered in the org's GitHub Users list with Active status
- **First-user bootstrap**: on a fresh database with no users, the first GitHub login is allowed unconditionally and promoted to super admin
- **Auto-registration**: PR authors and reviewers are automatically added as inactive GitHub users during crawl — an admin enables them via Settings > GitHub Users

## License

[O'Saasy License](./LICENSE)
