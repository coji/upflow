import { consola } from 'consola'
import 'dotenv/config'
import { nanoid } from 'nanoid'
import { copyFileSync } from 'node:fs'
import { db, sql } from '~/app/services/db.server'
import {
  closeTenantDb,
  createTenantDb,
  getTenantDb,
  getTenantDbPath,
} from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

async function seed() {
  // Clear existing shared data (child tables first for FK constraints)
  await db.deleteFrom('members').execute()
  await db.deleteFrom('organizations').execute()
  await db.deleteFrom('sessions').execute()
  await db.deleteFrom('accounts').execute()
  await db.deleteFrom('users').execute()

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'

  // user
  const user = await db
    .insertInto('users')
    .values({
      id: nanoid(),
      email,
      name: 'Coji Mizoguchi',
      emailVerified: sql`CURRENT_TIMESTAMP`,
      image: 'https://avatars.githubusercontent.com/u/12345678?v=4',
      role: 'admin',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // organization
  const organization = await db
    .insertInto('organizations')
    .values({
      id: nanoid(),
      name: 'TechTalk',
      slug: 'techtalk',
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // member user (non-admin, for testing role-based UI)
  const memberUser = await db
    .insertInto('users')
    .values({
      id: nanoid(),
      email: process.env.SEED_MEMBER_EMAIL ?? 'member@example.com',
      name: 'Member User',
      emailVerified: sql`CURRENT_TIMESTAMP`,
      image: null,
      role: 'user',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // member (owner)
  await db
    .insertInto('members')
    .values({
      id: nanoid(),
      organizationId: organization.id,
      userId: user.id,
      role: 'owner',
      createdAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // member (member role)
  await db
    .insertInto('members')
    .values({
      id: nanoid(),
      organizationId: organization.id,
      userId: memberUser.id,
      role: 'member',
      createdAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // --- Tenant DB ---
  // Create tenant DB file and apply migrations
  const orgId = organization.id as OrganizationId
  const tenantDbPath = getTenantDbPath(orgId)
  consola.info(`Creating tenant DB at ${tenantDbPath}...`)
  createTenantDb(orgId)

  const tenantDb = getTenantDb(orgId)

  // organization settings
  await tenantDb
    .insertInto('organizationSettings')
    .values({
      id: nanoid(),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // export settings
  await tenantDb
    .insertInto('exportSettings')
    .values({
      id: nanoid(),
      sheetId: '',
      clientEmail: '',
      privateKey: '',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // integration
  const integration = await tenantDb
    .insertInto('integrations')
    .values({
      id: nanoid(),
      provider: 'github',
      method: 'token',
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // repositories
  const frontendRepo = await tenantDb
    .insertInto('repositories')
    .values({
      id: nanoid(),
      provider: 'github',
      owner: 'techtalk',
      repo: 'frontend',
      integrationId: integration.id,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  const backendRepo = await tenantDb
    .insertInto('repositories')
    .values({
      id: nanoid(),
      provider: 'github',
      owner: 'techtalk',
      repo: 'backend',
      integrationId: integration.id,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // company github users (seed admin + fictional team members)
  const adminGithubLogin = process.env.SEED_ADMIN_GITHUB_LOGIN ?? 'test_user'
  const githubUsers = [
    { login: adminGithubLogin, displayName: user.name ?? adminGithubLogin },
    { login: 'alice', displayName: 'Alice Chen' },
    { login: 'bob', displayName: 'Bob Smith' },
    { login: 'charlie', displayName: 'Charlie Lee' },
    { login: 'diana', displayName: 'Diana Park' },
    { login: 'evan', displayName: 'Evan Tanaka' },
  ]
  for (const u of githubUsers) {
    await tenantDb
      .insertInto('companyGithubUsers')
      .values({
        login: u.login,
        displayName: u.displayName,
        isActive: 1,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .execute()
  }

  // Helper: date relative to now
  const daysAgo = (d: number) => {
    const date = new Date()
    date.setDate(date.getDate() - d)
    return date.toISOString()
  }

  // --- Merged PRs (for WIP cycle & PR size charts) ---
  // c = complexity, cr = complexityReason, ra = riskAreas
  const mergedPRs = [
    // XS PRs (additions+deletions < 10) — fast reviews
    {
      n: 1,
      repo: frontendRepo,
      title: 'Fix typo in README',
      author: 'alice',
      add: 1,
      del: 1,
      reviewTime: 0.02,
      createdDaysAgo: 90,
      mergedDaysAgo: 90,
      c: 'XS',
      cr: 'Single character fix in documentation',
      ra: null,
    },
    {
      n: 2,
      repo: frontendRepo,
      title: 'Update copyright year',
      author: 'bob',
      add: 2,
      del: 2,
      reviewTime: 0.01,
      createdDaysAgo: 85,
      mergedDaysAgo: 85,
      c: 'XS',
      cr: 'Trivial year bump in footer',
      ra: null,
    },
    {
      n: 3,
      repo: backendRepo,
      title: 'Fix env variable name',
      author: 'charlie',
      add: 3,
      del: 1,
      reviewTime: 0.04,
      createdDaysAgo: 80,
      mergedDaysAgo: 80,
      c: 'XS',
      cr: 'Rename of a single env variable reference',
      ra: 'configuration',
    },
    {
      n: 4,
      repo: frontendRepo,
      title: 'Remove unused import',
      author: 'diana',
      add: 0,
      del: 3,
      reviewTime: 0.01,
      createdDaysAgo: 75,
      mergedDaysAgo: 75,
      c: 'XS',
      cr: 'Dead code removal, no logic change',
      ra: null,
    },
    {
      n: 5,
      repo: backendRepo,
      title: 'Fix config comment',
      author: 'alice',
      add: 2,
      del: 0,
      reviewTime: 0.03,
      createdDaysAgo: 70,
      mergedDaysAgo: 70,
      c: 'XS',
      cr: 'Comment-only change',
      ra: null,
    },
    // S PRs (10-50 lines) — quick reviews
    {
      n: 6,
      repo: frontendRepo,
      title: 'Add loading spinner component',
      author: 'bob',
      add: 25,
      del: 3,
      reviewTime: 0.1,
      createdDaysAgo: 88,
      mergedDaysAgo: 87,
      c: 'S',
      cr: 'New presentational component with no side effects',
      ra: null,
    },
    {
      n: 7,
      repo: backendRepo,
      title: 'Add health check endpoint',
      author: 'charlie',
      add: 30,
      del: 5,
      reviewTime: 0.15,
      createdDaysAgo: 82,
      mergedDaysAgo: 81,
      c: 'S',
      cr: 'Simple GET endpoint returning status',
      ra: 'api',
    },
    {
      n: 8,
      repo: frontendRepo,
      title: 'Update button styles',
      author: 'alice',
      add: 15,
      del: 10,
      reviewTime: 0.08,
      createdDaysAgo: 65,
      mergedDaysAgo: 64,
      c: 'S',
      cr: 'CSS-only changes to button variants',
      ra: null,
    },
    {
      n: 9,
      repo: backendRepo,
      title: 'Add input validation for email',
      author: 'diana',
      add: 20,
      del: 8,
      reviewTime: 0.2,
      createdDaysAgo: 60,
      mergedDaysAgo: 59,
      c: 'S',
      cr: 'Adds Zod schema validation for email field',
      ra: 'validation',
    },
    {
      n: 10,
      repo: frontendRepo,
      title: 'Fix responsive layout issue',
      author: 'evan',
      add: 18,
      del: 12,
      reviewTime: 0.12,
      createdDaysAgo: 55,
      mergedDaysAgo: 54,
      c: 'S',
      cr: 'Media query adjustments for mobile breakpoint',
      ra: null,
    },
    {
      n: 11,
      repo: backendRepo,
      title: 'Add rate limit config',
      author: 'alice',
      add: 22,
      del: 5,
      reviewTime: 0.1,
      createdDaysAgo: 50,
      mergedDaysAgo: 49,
      c: 'S',
      cr: 'Configuration file addition with sensible defaults',
      ra: 'configuration, security',
    },
    // M PRs (50-200 lines) — moderate reviews
    {
      n: 12,
      repo: frontendRepo,
      title: 'Add user profile page',
      author: 'bob',
      add: 80,
      del: 15,
      reviewTime: 0.5,
      createdDaysAgo: 86,
      mergedDaysAgo: 84,
      c: 'M',
      cr: 'New page with form and data fetching, single concern',
      ra: 'authentication',
    },
    {
      n: 13,
      repo: backendRepo,
      title: 'Implement pagination for API',
      author: 'charlie',
      add: 60,
      del: 20,
      reviewTime: 0.8,
      createdDaysAgo: 78,
      mergedDaysAgo: 76,
      c: 'M',
      cr: 'Adds cursor-based pagination to list endpoints',
      ra: 'api, database',
    },
    {
      n: 14,
      repo: frontendRepo,
      title: 'Add dark mode toggle',
      author: 'diana',
      add: 100,
      del: 40,
      reviewTime: 1.0,
      createdDaysAgo: 72,
      mergedDaysAgo: 70,
      c: 'M',
      cr: 'Theme provider with CSS variable switching',
      ra: null,
    },
    {
      n: 15,
      repo: backendRepo,
      title: 'Add webhook handler',
      author: 'evan',
      add: 70,
      del: 10,
      reviewTime: 0.6,
      createdDaysAgo: 68,
      mergedDaysAgo: 66,
      c: 'M',
      cr: 'New endpoint with signature verification and event dispatch',
      ra: 'security, api',
    },
    {
      n: 16,
      repo: frontendRepo,
      title: 'Refactor form validation',
      author: 'alice',
      add: 90,
      del: 60,
      reviewTime: 1.2,
      createdDaysAgo: 58,
      mergedDaysAgo: 55,
      c: 'M',
      cr: 'Migrates 3 forms from manual validation to Conform+Zod',
      ra: 'validation',
    },
    {
      n: 17,
      repo: backendRepo,
      title: 'Add caching layer',
      author: 'bob',
      add: 75,
      del: 25,
      reviewTime: 0.7,
      createdDaysAgo: 48,
      mergedDaysAgo: 46,
      c: 'M',
      cr: 'In-memory TTL cache with invalidation logic',
      ra: 'performance',
    },
    {
      n: 18,
      repo: frontendRepo,
      title: 'Implement search filters',
      author: 'charlie',
      add: 110,
      del: 30,
      reviewTime: 1.5,
      createdDaysAgo: 42,
      mergedDaysAgo: 39,
      c: 'M',
      cr: 'Multi-field filter UI with URL state synchronization',
      ra: null,
    },
    {
      n: 19,
      repo: backendRepo,
      title: 'Add email notification service',
      author: 'diana',
      add: 85,
      del: 15,
      reviewTime: 0.9,
      createdDaysAgo: 35,
      mergedDaysAgo: 33,
      c: 'M',
      cr: 'New service with template rendering and queue integration',
      ra: 'external-service',
    },
    // L PRs (200-500 lines) — slow reviews
    {
      n: 20,
      repo: frontendRepo,
      title: 'Redesign dashboard layout',
      author: 'alice',
      add: 250,
      del: 80,
      reviewTime: 2.5,
      createdDaysAgo: 84,
      mergedDaysAgo: 80,
      c: 'L',
      cr: 'Major layout restructuring across 8 components',
      ra: null,
    },
    {
      n: 21,
      repo: backendRepo,
      title: 'Add OAuth2 integration',
      author: 'bob',
      add: 200,
      del: 50,
      reviewTime: 3.0,
      createdDaysAgo: 74,
      mergedDaysAgo: 69,
      c: 'L',
      cr: 'Full OAuth2 flow with token management and refresh logic',
      ra: 'authentication, security',
    },
    {
      n: 22,
      repo: frontendRepo,
      title: 'Implement chart components',
      author: 'charlie',
      add: 300,
      del: 100,
      reviewTime: 3.5,
      createdDaysAgo: 62,
      mergedDaysAgo: 56,
      c: 'L',
      cr: 'Multiple Recharts wrappers with shared config and theming',
      ra: null,
    },
    {
      n: 23,
      repo: backendRepo,
      title: 'Add batch processing pipeline',
      author: 'evan',
      add: 220,
      del: 60,
      reviewTime: 2.8,
      createdDaysAgo: 52,
      mergedDaysAgo: 47,
      c: 'L',
      cr: 'New batch job framework with retry and error handling',
      ra: 'database, error-handling',
    },
    {
      n: 24,
      repo: frontendRepo,
      title: 'Add table component with sorting',
      author: 'diana',
      add: 280,
      del: 40,
      reviewTime: 4.0,
      createdDaysAgo: 38,
      mergedDaysAgo: 32,
      c: 'L',
      cr: 'Generic data table with column sorting, filtering, and pagination',
      ra: null,
    },
    // XL PRs (>500 lines) — very slow reviews
    {
      n: 25,
      repo: backendRepo,
      title: 'Migrate database to multi-tenant',
      author: 'alice',
      add: 500,
      del: 200,
      reviewTime: 7.0,
      createdDaysAgo: 82,
      mergedDaysAgo: 70,
      c: 'XL',
      cr: 'Database-per-tenant migration affecting all data access layers',
      ra: 'database, security, data-migration',
    },
    {
      n: 26,
      repo: frontendRepo,
      title: 'Complete app redesign v2',
      author: 'bob',
      add: 800,
      del: 400,
      reviewTime: 10.0,
      createdDaysAgo: 64,
      mergedDaysAgo: 50,
      c: 'XL',
      cr: 'Full UI overhaul touching 30+ components and routing',
      ra: null,
    },
    {
      n: 27,
      repo: backendRepo,
      title: 'Add GraphQL API layer',
      author: 'charlie',
      add: 600,
      del: 150,
      reviewTime: 8.0,
      createdDaysAgo: 45,
      mergedDaysAgo: 35,
      c: 'XL',
      cr: 'New GraphQL schema, resolvers, and auth middleware',
      ra: 'api, authentication, security',
    },
    {
      n: 28,
      repo: frontendRepo,
      title: 'Implement real-time updates',
      author: 'evan',
      add: 550,
      del: 100,
      reviewTime: 6.5,
      createdDaysAgo: 30,
      mergedDaysAgo: 22,
      c: 'XL',
      cr: 'WebSocket integration with reconnection and state sync',
      ra: 'external-service, error-handling',
    },
    // Recent merged PRs (various sizes, overlapping dates for WIP calculation)
    // alice has 3 PRs open simultaneously (high WIP)
    {
      n: 29,
      repo: frontendRepo,
      title: 'Add notification bell',
      author: 'alice',
      add: 45,
      del: 10,
      reviewTime: 0.3,
      createdDaysAgo: 20,
      mergedDaysAgo: 18,
      c: 'S',
      cr: 'New UI component with badge count from API',
      ra: null,
    },
    {
      n: 30,
      repo: backendRepo,
      title: 'Fix N+1 query in users',
      author: 'alice',
      add: 12,
      del: 8,
      reviewTime: 0.5,
      createdDaysAgo: 20,
      mergedDaysAgo: 17,
      c: 'S',
      cr: 'Replaces loop query with eager loading join',
      ra: 'database, performance',
    },
    {
      n: 31,
      repo: frontendRepo,
      title: 'Add breadcrumb navigation',
      author: 'alice',
      add: 35,
      del: 5,
      reviewTime: 0.8,
      createdDaysAgo: 19,
      mergedDaysAgo: 16,
      c: 'S',
      cr: 'Route-aware breadcrumb component',
      ra: null,
    },
    // bob has 1 PR open (low WIP)
    {
      n: 32,
      repo: backendRepo,
      title: 'Optimize database indexes',
      author: 'bob',
      add: 8,
      del: 3,
      reviewTime: 0.05,
      createdDaysAgo: 15,
      mergedDaysAgo: 15,
      c: 'XS',
      cr: 'Add composite index for frequent query pattern',
      ra: 'database, performance',
    },
    {
      n: 33,
      repo: frontendRepo,
      title: 'Fix accessibility issues',
      author: 'charlie',
      add: 50,
      del: 20,
      reviewTime: 0.4,
      createdDaysAgo: 12,
      mergedDaysAgo: 10,
      c: 'M',
      cr: 'ARIA labels, focus management, and keyboard navigation fixes',
      ra: null,
    },
    {
      n: 34,
      repo: backendRepo,
      title: 'Add request logging middleware',
      author: 'diana',
      add: 40,
      del: 5,
      reviewTime: 0.25,
      createdDaysAgo: 10,
      mergedDaysAgo: 8,
      c: 'S',
      cr: 'Express middleware for structured request/response logging',
      ra: null,
    },
    {
      n: 35,
      repo: frontendRepo,
      title: 'Update color tokens',
      author: 'evan',
      add: 5,
      del: 5,
      reviewTime: 0.02,
      createdDaysAgo: 7,
      mergedDaysAgo: 7,
      c: 'XS',
      cr: 'CSS variable value adjustments only',
      ra: null,
    },
    {
      n: 36,
      repo: backendRepo,
      title: 'Add API versioning headers',
      author: 'bob',
      add: 15,
      del: 3,
      reviewTime: 0.1,
      createdDaysAgo: 5,
      mergedDaysAgo: 4,
      c: 'S',
      cr: 'Middleware to set API-Version response header',
      ra: 'api',
    },
  ]

  for (const pr of mergedPRs) {
    const repoData = pr.repo
    await tenantDb
      .insertInto('pullRequests')
      .values({
        repo: `${repoData.owner}/${repoData.repo}`,
        number: pr.n,
        title: pr.title,
        author: pr.author,
        url: `https://github.com/${repoData.owner}/${repoData.repo}/pull/${pr.n}`,
        pullRequestCreatedAt: daysAgo(pr.createdDaysAgo),
        mergedAt: daysAgo(pr.mergedDaysAgo),
        state: 'closed',
        repositoryId: repoData.id,
        sourceBranch: `feature/pr-${pr.n}`,
        targetBranch: 'main',
        additions: pr.add,
        deletions: pr.del,
        changedFiles: Math.max(1, Math.floor((pr.add + pr.del) / 30)),
        reviewTime: pr.reviewTime,
        codingTime: pr.reviewTime * 0.5,
        pickupTime: pr.reviewTime * 0.3,
        totalTime: pr.reviewTime * 1.8,
        complexity: pr.c,
        complexityReason: pr.cr,
        riskAreas: pr.ra,
        classifiedAt: daysAgo(pr.mergedDaysAgo),
        classifierModel: 'gemini-2.0-flash-lite',
      })
      .execute()
  }

  // --- Open PRs (for reviewer queue chart) ---
  const openPRs = [
    {
      n: 101,
      repo: frontendRepo,
      title: 'Add settings page redesign',
      author: 'alice',
      add: 180,
      del: 60,
      createdDaysAgo: 3,
      c: 'M',
      cr: 'Settings UI restructuring with new form sections',
      ra: null,
    },
    {
      n: 102,
      repo: backendRepo,
      title: 'Implement SSO login flow',
      author: 'bob',
      add: 300,
      del: 50,
      createdDaysAgo: 5,
      c: 'L',
      cr: 'SAML/OIDC integration with session management changes',
      ra: 'authentication, security',
    },
    {
      n: 103,
      repo: frontendRepo,
      title: 'Fix mobile navigation menu',
      author: 'charlie',
      add: 25,
      del: 10,
      createdDaysAgo: 1,
      c: 'S',
      cr: 'Hamburger menu z-index and animation fix',
      ra: null,
    },
    {
      n: 104,
      repo: backendRepo,
      title: 'Add audit log for admin actions',
      author: 'diana',
      add: 150,
      del: 20,
      createdDaysAgo: 4,
      c: 'M',
      cr: 'New audit_logs table with middleware for admin routes',
      ra: 'database, security',
    },
    {
      n: 105,
      repo: frontendRepo,
      title: 'Implement drag-and-drop kanban',
      author: 'evan',
      add: 400,
      del: 30,
      createdDaysAgo: 6,
      c: 'L',
      cr: 'Complex DnD interactions with optimistic state updates',
      ra: 'error-handling',
    },
    {
      n: 106,
      repo: backendRepo,
      title: 'Upgrade authentication library',
      author: 'alice',
      add: 80,
      del: 60,
      createdDaysAgo: 2,
      c: 'M',
      cr: 'Major version bump with breaking API changes in auth flow',
      ra: 'authentication, security',
    },
    {
      n: 107,
      repo: frontendRepo,
      title: 'Add error boundary components',
      author: 'bob',
      add: 45,
      del: 5,
      createdDaysAgo: 1,
      c: 'S',
      cr: 'React error boundaries for route-level error handling',
      ra: 'error-handling',
    },
    {
      n: 108,
      repo: backendRepo,
      title: 'Add API rate limiting',
      author: 'charlie',
      add: 90,
      del: 15,
      createdDaysAgo: 3,
      c: 'M',
      cr: 'Redis-backed rate limiter with per-endpoint configuration',
      ra: 'security, performance, external-service',
    },
  ]

  for (const pr of openPRs) {
    const repoData = pr.repo
    await tenantDb
      .insertInto('pullRequests')
      .values({
        repo: `${repoData.owner}/${repoData.repo}`,
        number: pr.n,
        title: pr.title,
        author: pr.author,
        url: `https://github.com/${repoData.owner}/${repoData.repo}/pull/${pr.n}`,
        pullRequestCreatedAt: daysAgo(pr.createdDaysAgo),
        state: 'open',
        repositoryId: repoData.id,
        sourceBranch: `feature/pr-${pr.n}`,
        targetBranch: 'main',
        additions: pr.add,
        deletions: pr.del,
        changedFiles: Math.max(1, Math.floor((pr.add + pr.del) / 30)),
        complexity: pr.c,
        complexityReason: pr.cr,
        riskAreas: pr.ra,
        classifiedAt: daysAgo(pr.createdDaysAgo),
        classifierModel: 'gemini-2.0-flash-lite',
      })
      .execute()
  }

  // --- Reviewer assignments for merged PRs (historical data for queue trend) ---
  const mergedReviewerAssignments = [
    // 90-80 days ago: early period
    {
      prNumber: 1,
      repoId: frontendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 90,
      resolvedDaysAgo: 90,
    },
    {
      prNumber: 2,
      repoId: frontendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 85,
      resolvedDaysAgo: 85,
    },
    {
      prNumber: 6,
      repoId: frontendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 88,
      resolvedDaysAgo: 87,
    },
    {
      prNumber: 7,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 82,
      resolvedDaysAgo: 81,
    },
    {
      prNumber: 12,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 86,
      resolvedDaysAgo: 84,
    },
    {
      prNumber: 25,
      repoId: backendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 82,
      resolvedDaysAgo: 75,
    },
    {
      prNumber: 25,
      repoId: backendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 82,
      resolvedDaysAgo: 72,
    },
    {
      prNumber: 20,
      repoId: frontendRepo.id,
      reviewer: 'evan',
      requestedDaysAgo: 84,
      resolvedDaysAgo: 81,
    },
    // 80-60 days ago: growing queue
    {
      prNumber: 3,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 80,
      resolvedDaysAgo: 80,
    },
    {
      prNumber: 13,
      repoId: backendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 78,
      resolvedDaysAgo: 76,
    },
    {
      prNumber: 14,
      repoId: frontendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 72,
      resolvedDaysAgo: 70,
    },
    {
      prNumber: 21,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 74,
      resolvedDaysAgo: 70,
    },
    {
      prNumber: 21,
      repoId: backendRepo.id,
      reviewer: 'evan',
      requestedDaysAgo: 74,
      resolvedDaysAgo: 71,
    },
    {
      prNumber: 4,
      repoId: frontendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 75,
      resolvedDaysAgo: 75,
    },
    {
      prNumber: 26,
      repoId: frontendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 64,
      resolvedDaysAgo: 55,
    },
    {
      prNumber: 26,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 64,
      resolvedDaysAgo: 52,
    },
    {
      prNumber: 22,
      repoId: frontendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 62,
      resolvedDaysAgo: 58,
    },
    // 60-40 days ago: moderate queue
    {
      prNumber: 8,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 65,
      resolvedDaysAgo: 64,
    },
    {
      prNumber: 15,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 68,
      resolvedDaysAgo: 66,
    },
    {
      prNumber: 9,
      repoId: backendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 60,
      resolvedDaysAgo: 59,
    },
    {
      prNumber: 10,
      repoId: frontendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 55,
      resolvedDaysAgo: 54,
    },
    {
      prNumber: 16,
      repoId: frontendRepo.id,
      reviewer: 'evan',
      requestedDaysAgo: 58,
      resolvedDaysAgo: 56,
    },
    {
      prNumber: 23,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 52,
      resolvedDaysAgo: 48,
    },
    {
      prNumber: 23,
      repoId: backendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 52,
      resolvedDaysAgo: 49,
    },
    {
      prNumber: 17,
      repoId: backendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 48,
      resolvedDaysAgo: 46,
    },
    {
      prNumber: 27,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 45,
      resolvedDaysAgo: 38,
    },
    {
      prNumber: 27,
      repoId: backendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 45,
      resolvedDaysAgo: 37,
    },
    {
      prNumber: 18,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 42,
      resolvedDaysAgo: 40,
    },
    // 40-20 days ago: increasing queue (bottleneck forming)
    {
      prNumber: 11,
      repoId: backendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 50,
      resolvedDaysAgo: 49,
    },
    {
      prNumber: 19,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 35,
      resolvedDaysAgo: 33,
    },
    {
      prNumber: 24,
      repoId: frontendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 38,
      resolvedDaysAgo: 34,
    },
    {
      prNumber: 24,
      repoId: frontendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 38,
      resolvedDaysAgo: 33,
    },
    {
      prNumber: 28,
      repoId: frontendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 30,
      resolvedDaysAgo: 25,
    },
    {
      prNumber: 28,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 30,
      resolvedDaysAgo: 23,
    },
    // 20-0 days ago: recent activity
    {
      prNumber: 29,
      repoId: frontendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 20,
      resolvedDaysAgo: 19,
    },
    {
      prNumber: 30,
      repoId: backendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 20,
      resolvedDaysAgo: 18,
    },
    {
      prNumber: 31,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 19,
      resolvedDaysAgo: 17,
    },
    {
      prNumber: 32,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 15,
      resolvedDaysAgo: 15,
    },
    {
      prNumber: 33,
      repoId: frontendRepo.id,
      reviewer: 'evan',
      requestedDaysAgo: 12,
      resolvedDaysAgo: 10,
    },
    {
      prNumber: 34,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 10,
      resolvedDaysAgo: 8,
    },
    {
      prNumber: 35,
      repoId: frontendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 7,
      resolvedDaysAgo: 7,
    },
    {
      prNumber: 36,
      repoId: backendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 5,
      resolvedDaysAgo: 4,
    },
  ]

  for (const ra of mergedReviewerAssignments) {
    await tenantDb
      .insertInto('pullRequestReviewers')
      .values({
        pullRequestNumber: ra.prNumber,
        repositoryId: ra.repoId,
        reviewer: ra.reviewer,
        requestedAt: daysAgo(ra.requestedDaysAgo),
      })
      .execute()

    // Add corresponding review for resolved assignments
    await tenantDb
      .insertInto('pullRequestReviews')
      .values({
        id: nanoid(),
        pullRequestNumber: ra.prNumber,
        repositoryId: ra.repoId,
        reviewer: ra.reviewer,
        state:
          ra.resolvedDaysAgo === ra.requestedDaysAgo
            ? 'APPROVED'
            : ra.resolvedDaysAgo - ra.requestedDaysAgo > 3
              ? 'CHANGES_REQUESTED'
              : 'APPROVED',
        submittedAt: daysAgo(ra.resolvedDaysAgo),
        url: `https://github.com/techtalk/${ra.repoId === frontendRepo.id ? 'frontend' : 'backend'}/pull/${ra.prNumber}#pullrequestreview-${nanoid(6)}`,
      })
      .execute()
  }

  // --- Reviewer assignments for open PRs ---
  const reviewerAssignments = [
    // alice is assigned to review 4 PRs (bottleneck!)
    {
      prNumber: 102,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 5,
    },
    {
      prNumber: 103,
      repoId: frontendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 1,
    },
    {
      prNumber: 104,
      repoId: backendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 4,
    },
    {
      prNumber: 105,
      repoId: frontendRepo.id,
      reviewer: 'alice',
      requestedDaysAgo: 6,
    },
    // bob reviews 3 PRs
    {
      prNumber: 101,
      repoId: frontendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 3,
    },
    {
      prNumber: 104,
      repoId: backendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 4,
    },
    {
      prNumber: 108,
      repoId: backendRepo.id,
      reviewer: 'bob',
      requestedDaysAgo: 3,
    },
    // charlie reviews 2 PRs
    {
      prNumber: 101,
      repoId: frontendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 3,
    },
    {
      prNumber: 106,
      repoId: backendRepo.id,
      reviewer: 'charlie',
      requestedDaysAgo: 2,
    },
    // diana reviews 2 PRs
    {
      prNumber: 105,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 6,
    },
    {
      prNumber: 107,
      repoId: frontendRepo.id,
      reviewer: 'diana',
      requestedDaysAgo: 1,
    },
    // evan reviews 1 PR
    {
      prNumber: 102,
      repoId: backendRepo.id,
      reviewer: 'evan',
      requestedDaysAgo: 5,
    },
  ]

  for (const ra of reviewerAssignments) {
    await tenantDb
      .insertInto('pullRequestReviewers')
      .values({
        pullRequestNumber: ra.prNumber,
        repositoryId: ra.repoId,
        reviewer: ra.reviewer,
        requestedAt: daysAgo(ra.requestedDaysAgo),
      })
      .execute()
  }

  // --- Reviews (some reviewers already reviewed — should be excluded from queue) ---
  // charlie already approved PR 101 → should NOT appear in queue for PR 101
  await tenantDb
    .insertInto('pullRequestReviews')
    .values({
      id: nanoid(),
      pullRequestNumber: 101,
      repositoryId: frontendRepo.id,
      reviewer: 'charlie',
      state: 'APPROVED',
      submittedAt: daysAgo(1),
      url: 'https://github.com/techtalk/frontend/pull/101#pullrequestreview-1',
    })
    .execute()

  // bob requested changes on PR 104 → should NOT appear in queue for PR 104
  await tenantDb
    .insertInto('pullRequestReviews')
    .values({
      id: nanoid(),
      pullRequestNumber: 104,
      repositoryId: backendRepo.id,
      reviewer: 'bob',
      state: 'CHANGES_REQUESTED',
      submittedAt: daysAgo(1),
      url: 'https://github.com/techtalk/backend/pull/104#pullrequestreview-2',
    })
    .execute()

  // evan left a comment (not approval) on PR 102 → should STILL appear in queue
  await tenantDb
    .insertInto('pullRequestReviews')
    .values({
      id: nanoid(),
      pullRequestNumber: 102,
      repositoryId: backendRepo.id,
      reviewer: 'evan',
      state: 'COMMENTED',
      submittedAt: daysAgo(1),
      url: 'https://github.com/techtalk/backend/pull/102#pullrequestreview-3',
    })
    .execute()

  // Close tenant DB connection to flush WAL before copying
  await closeTenantDb(orgId)

  // Copy tenant DB for type generation (used by db:generate:tenant)
  copyFileSync(tenantDbPath, './data/tenant_seed.db')

  consola.info('Database has been seeded. 🌱')
}

seed().catch((e) => {
  consola.error(e)
  process.exit(1)
})
