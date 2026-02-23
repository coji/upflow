/**
 * 001 - レビューキュー可視化
 *
 * レビューイベントデータからキュー増減イベントを生成し、
 * review-queue-player.html 用の JSON を出力する。
 *
 * Usage:
 *   pnpm tsx lab/experiments/001-queue-visualization.ts
 */

import consola from 'consola'
import fs from 'node:fs'
import path from 'node:path'
import type { ReviewEventPR } from '../lib/github'

const DATA_DIR = path.join(import.meta.dirname, '..', 'data')
const OUTPUT_DIR = path.join(import.meta.dirname, '..', 'output')

interface QueueEvent {
  time: string
  reviewer: string
  type: 'add' | 'remove'
  reason: string
  pr: {
    number: number
    title: string
    author: string
    repo: string
    createdAt: string
    mergedAt: string | null
  }
}

function processReviewEvents(data: ReviewEventPR[]): QueueEvent[] {
  const events: QueueEvent[] = []

  for (const pr of data) {
    const prInfo = {
      number: pr.number,
      title: pr.title,
      author: pr.author?.login || 'unknown',
      repo: pr.repo,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
    }

    const timeline = pr.timelineItems?.nodes || []
    const pendingReviewers = new Set<string>()
    let isDraft = false

    for (const event of timeline) {
      const time = event.createdAt

      switch (event.__typename) {
        case 'ConvertToDraftEvent':
          isDraft = true
          for (const reviewer of pendingReviewers) {
            events.push({
              time,
              reviewer,
              type: 'remove',
              reason: 'draft',
              pr: prInfo,
            })
          }
          pendingReviewers.clear()
          break

        case 'ReadyForReviewEvent':
          isDraft = false
          break

        case 'ReviewRequestedEvent': {
          const reviewer =
            event.requestedReviewer?.login || event.requestedReviewer?.name
          if (reviewer && !isDraft) {
            if (!pendingReviewers.has(reviewer)) {
              pendingReviewers.add(reviewer)
              events.push({
                time,
                reviewer,
                type: 'add',
                reason: 'requested',
                pr: prInfo,
              })
            }
          }
          break
        }

        case 'ReviewRequestRemovedEvent': {
          const reviewer =
            event.requestedReviewer?.login || event.requestedReviewer?.name
          if (reviewer && pendingReviewers.has(reviewer)) {
            pendingReviewers.delete(reviewer)
            events.push({
              time,
              reviewer,
              type: 'remove',
              reason: 'removed',
              pr: prInfo,
            })
          }
          break
        }

        case 'PullRequestReview': {
          const reviewer = event.author?.login
          if (reviewer && pendingReviewers.has(reviewer)) {
            pendingReviewers.delete(reviewer)
            events.push({
              time,
              reviewer,
              type: 'remove',
              reason: event.state?.toLowerCase() || 'reviewed',
              pr: prInfo,
            })
          }
          break
        }
      }
    }

    // PR がマージされたのに未レビューの人がいたら、マージ時に除去
    if (pr.mergedAt) {
      for (const reviewer of pendingReviewers) {
        events.push({
          time: pr.mergedAt,
          reviewer,
          type: 'remove',
          reason: 'merged',
          pr: prInfo,
        })
      }
    }
  }

  events.sort((a, b) => a.time.localeCompare(b.time))
  return events
}

function main() {
  const inputFile = path.join(DATA_DIR, 'review-events.json')
  if (!fs.existsSync(inputFile)) {
    consola.error(`Data not found: ${inputFile}`)
    consola.info('Run: pnpm tsx lab/fetch.ts --only events')
    process.exit(1)
  }

  const data: ReviewEventPR[] = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  consola.info(`Loaded ${data.length} PRs`)

  const events = processReviewEvents(data)

  // 統計
  const reviewerStats: Record<string, { adds: number; removes: number }> = {}
  for (const e of events) {
    if (!reviewerStats[e.reviewer])
      reviewerStats[e.reviewer] = { adds: 0, removes: 0 }
    if (e.type === 'add') reviewerStats[e.reviewer].adds++
    else reviewerStats[e.reviewer].removes++
  }

  consola.info(`Total events: ${events.length}`)
  consola.info(`Reviewers: ${Object.keys(reviewerStats).length}`)

  // 2025年以降のイベントのみ出力
  const recentEvents = events.filter((e) => e.time >= '2025-01-01')
  consola.info(`2025+ events: ${recentEvents.length}`)

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const outputFile = path.join(OUTPUT_DIR, 'review-queue-events.json')
  fs.writeFileSync(outputFile, JSON.stringify(recentEvents))
  consola.success(`Output: ${outputFile}`)
}

main()
