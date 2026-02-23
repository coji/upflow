/**
 * lab/fetch.ts — データ取得CLI
 *
 * Usage:
 *   pnpm tsx lab/fetch.ts                    # 全データ取得
 *   pnpm tsx lab/fetch.ts --only events      # レビューイベントのみ
 *   pnpm tsx lab/fetch.ts --only sizes       # PRサイズのみ
 *   pnpm tsx lab/fetch.ts --refresh          # キャッシュを無視して再取得
 *   pnpm tsx lab/fetch.ts --max-pages 4      # ページネーション上限
 */

import consola from 'consola'
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { getOrganization, listAllOrganizations } from '~/batch/db/queries'
import { createGitHubClient } from './lib/github'

const DATA_DIR = path.join(import.meta.dirname, 'data')

// Parse args
const args = process.argv.slice(2)
const only = args.includes('--only')
  ? args[args.indexOf('--only') + 1]
  : undefined
const refresh = args.includes('--refresh')
const maxPagesIdx = args.indexOf('--max-pages')
const maxPages = maxPagesIdx >= 0 ? Number(args[maxPagesIdx + 1]) : 8

async function main() {
  // Ensure data directory
  fs.mkdirSync(DATA_DIR, { recursive: true })

  // Get first organization from DB
  const orgs = await listAllOrganizations()
  if (orgs.length === 0) {
    consola.error('No organizations found in database')
    process.exit(1)
  }

  const org = await getOrganization(orgs[0].id)
  if (!org.integration) {
    consola.error('No integration configured for organization:', org.name)
    process.exit(1)
  }

  const token = org.integration.privateToken
  if (!token) {
    consola.error('No GitHub token found in integration')
    process.exit(1)
  }

  const client = createGitHubClient(token)

  consola.info(`Organization: ${org.name}`)
  consola.info(
    `Repositories: ${org.repositories.map((r) => r.repo).join(', ')}`,
  )
  consola.info(`Max pages: ${maxPages}`)

  for (const repo of org.repositories) {
    const owner = repo.owner
    const repoName = repo.repo
    consola.info(`\n--- ${owner}/${repoName} ---`)

    try {
      // Fetch review events
      if (!only || only === 'events') {
        const eventsFile = path.join(DATA_DIR, `review-events-${repoName}.json`)
        if (!refresh && fs.existsSync(eventsFile)) {
          consola.info(`  [events] Using cache: ${eventsFile}`)
        } else {
          consola.start(`  [events] Fetching...`)
          const events = await client.fetchReviewEvents(owner, repoName, {
            maxPages,
          })
          fs.writeFileSync(eventsFile, JSON.stringify(events, null, 2))
          consola.success(`  [events] ${events.length} PRs → ${eventsFile}`)
        }
      }

      // Fetch PR sizes
      if (!only || only === 'sizes') {
        const sizesFile = path.join(DATA_DIR, `pr-sizes-${repoName}.json`)
        if (!refresh && fs.existsSync(sizesFile)) {
          consola.info(`  [sizes] Using cache: ${sizesFile}`)
        } else {
          consola.start(`  [sizes] Fetching...`)
          const sizes = await client.fetchPRSizes(owner, repoName, { maxPages })
          fs.writeFileSync(sizesFile, JSON.stringify(sizes, null, 2))
          consola.success(`  [sizes] ${sizes.length} PRs → ${sizesFile}`)
        }
      }
    } catch (err) {
      consola.warn(
        `  Skipped (error): ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  // Merge all repos into combined files
  if (!only || only === 'events') {
    const allEvents = org.repositories.flatMap((repo) => {
      const file = path.join(DATA_DIR, `review-events-${repo.repo}.json`)
      return fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf-8'))
        : []
    })
    const combinedFile = path.join(DATA_DIR, 'review-events.json')
    fs.writeFileSync(combinedFile, JSON.stringify(allEvents, null, 2))
    consola.success(
      `\nCombined events: ${allEvents.length} PRs → ${combinedFile}`,
    )
  }

  if (!only || only === 'sizes') {
    const allSizes = org.repositories.flatMap((repo) => {
      const file = path.join(DATA_DIR, `pr-sizes-${repo.repo}.json`)
      return fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf-8'))
        : []
    })
    const combinedFile = path.join(DATA_DIR, 'pr-sizes.json')
    fs.writeFileSync(combinedFile, JSON.stringify(allSizes, null, 2))
    consola.success(`Combined sizes: ${allSizes.length} PRs → ${combinedFile}`)
  }

  consola.success('\nDone!')
  process.exit(0)
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
