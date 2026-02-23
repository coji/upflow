/**
 * 002 - キューサイズ vs スループット相関分析
 *
 * レビューキューの大きさとマージスループットの相関を分析する。
 *
 * Usage:
 *   pnpm tsx lab/experiments/002-queue-throughput-correlation.ts
 */

import consola from 'consola'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(import.meta.dirname, '..', 'data')
const OUTPUT_DIR = path.join(import.meta.dirname, '..', 'output')
const PROJECT_ROOT = path.join(import.meta.dirname, '..', '..')

interface QueueEvent {
  time: string
  reviewer: string
  type: 'add' | 'remove'
  pr: { repo: string; number: number }
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  const avgX = xs.reduce((s, x) => s + x, 0) / n
  const avgY = ys.reduce((s, y) => s + y, 0) / n
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0
  for (let i = 0; i < n; i++) {
    sumXY += (xs[i] - avgX) * (ys[i] - avgY)
    sumX2 += (xs[i] - avgX) ** 2
    sumY2 += (ys[i] - avgY) ** 2
  }
  return sumXY / Math.sqrt(sumX2 * sumY2)
}

function main() {
  // 1. Load review queue events (001 の出力)
  const eventsFile = path.join(OUTPUT_DIR, 'review-queue-events.json')
  if (!fs.existsSync(eventsFile)) {
    consola.error(`Events not found: ${eventsFile}`)
    consola.info('Run: pnpm tsx lab/experiments/001-queue-visualization.ts')
    process.exit(1)
  }

  const events: QueueEvent[] = JSON.parse(fs.readFileSync(eventsFile, 'utf-8'))

  // 2. Get daily throughput from DB
  const throughputRaw = execSync(
    `sqlite3 data/data.db "SELECT date(merged_at), COUNT(*) FROM pull_requests WHERE merged_at IS NOT NULL AND merged_at >= '2025-01-01' AND author NOT LIKE '%[bot]%' AND author NOT LIKE '%bot' GROUP BY date(merged_at) ORDER BY date(merged_at)"`,
    { cwd: PROJECT_ROOT },
  )
    .toString()
    .trim()

  const throughputMap: Record<string, number> = {}
  for (const line of throughputRaw.split('\n')) {
    const [day, count] = line.split('|')
    throughputMap[day] = Number.parseInt(count)
  }

  // 3. Replay events and compute daily queue size
  const reviewerQueues: Record<string, Set<string>> = {}

  function prKey(pr: { repo: string; number: number }) {
    return `${pr.repo}#${pr.number}`
  }

  let eventIdx = 0
  const dailyQueue: Record<string, number> = {}

  const startDate = new Date('2025-01-01')
  const endDate = new Date()

  for (
    const d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dayStr = d.toISOString().slice(0, 10)
    const dayEnd = `${dayStr}T23:59:59Z`

    while (eventIdx < events.length && events[eventIdx].time <= dayEnd) {
      const e = events[eventIdx]
      const key = prKey(e.pr)
      const reviewer = e.reviewer
      if (!reviewerQueues[reviewer]) reviewerQueues[reviewer] = new Set()

      if (e.type === 'add') {
        reviewerQueues[reviewer].add(key)
      } else {
        reviewerQueues[reviewer].delete(key)
      }
      eventIdx++
    }

    let totalQueue = 0
    for (const reviewer in reviewerQueues) {
      totalQueue += reviewerQueues[reviewer].size
    }
    dailyQueue[dayStr] = totalQueue
  }

  // 4. Build combined dataset (weekdays only)
  const combined: { day: string; queue: number; throughput: number }[] = []

  for (const day in throughputMap) {
    const dow = new Date(day).getDay()
    if (dow === 0 || dow === 6) continue
    combined.push({
      day,
      queue: dailyQueue[day] || 0,
      throughput: throughputMap[day],
    })
  }

  for (const day in dailyQueue) {
    const dow = new Date(day).getDay()
    if (dow === 0 || dow === 6) continue
    if (throughputMap[day]) continue
    if (dailyQueue[day] > 0) {
      combined.push({ day, queue: dailyQueue[day], throughput: 0 })
    }
  }

  combined.sort((a, b) => a.day.localeCompare(b.day))

  // 5. Daily correlation
  const r = pearsonCorrelation(
    combined.map((d) => d.queue),
    combined.map((d) => d.throughput),
  )

  consola.info(`Data points: ${combined.length}`)
  consola.info(
    `Avg queue: ${(combined.reduce((s, d) => s + d.queue, 0) / combined.length).toFixed(1)}`,
  )
  consola.info(
    `Avg throughput: ${(combined.reduce((s, d) => s + d.throughput, 0) / combined.length).toFixed(1)}`,
  )
  consola.info(`Daily correlation (r): ${r.toFixed(3)}`)

  // 6. Weekly aggregation
  const weeklyMap: Record<
    string,
    { queueSum: number; throughputSum: number; count: number }
  > = {}
  for (const d of combined) {
    const date = new Date(d.day)
    const monday = new Date(date)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const weekKey = monday.toISOString().slice(0, 10)
    if (!weeklyMap[weekKey])
      weeklyMap[weekKey] = { queueSum: 0, throughputSum: 0, count: 0 }
    weeklyMap[weekKey].queueSum += d.queue
    weeklyMap[weekKey].throughputSum += d.throughput
    weeklyMap[weekKey].count++
  }

  const weekly = Object.entries(weeklyMap)
    .map(([week, v]) => ({
      week,
      avgQueue: v.queueSum / v.count,
      totalThroughput: v.throughputSum,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))

  const wr = pearsonCorrelation(
    weekly.map((d) => d.avgQueue),
    weekly.map((d) => d.totalThroughput),
  )

  consola.info(`Weekly correlation (r): ${wr.toFixed(3)}`)

  // 7. Save
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const outputFile = path.join(OUTPUT_DIR, 'queue-throughput-data.json')
  fs.writeFileSync(
    outputFile,
    JSON.stringify({
      daily: combined,
      weekly,
      correlation: { daily: r, weekly: wr },
    }),
  )
  consola.success(`Output: ${outputFile}`)
}

main()
