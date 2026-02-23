/**
 * 003 - オートマージシミュレーション
 *
 * PRを影響度ベースでサイズ分類し、XS/S の自動マージが
 * レビューキューに与える効果をシミュレーションする。
 *
 * Usage:
 *   pnpm tsx lab/experiments/003-automerge-simulation.ts
 */

import consola from 'consola'
import fs from 'node:fs'
import path from 'node:path'
import { type PRSize, classifyPR } from '../lib/classify'
import type { PRSizeInfo } from '../lib/github'

const DATA_DIR = path.join(import.meta.dirname, '..', 'data')
const OUTPUT_DIR = path.join(import.meta.dirname, '..', 'output')

interface QueueEvent {
  time: string
  reviewer: string
  type: 'add' | 'remove'
  pr: { repo: string; number: number }
}

interface ClassifiedPR {
  repo: string
  number: number
  title: string
  author: string | undefined
  createdAt: string
  mergedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  size: PRSize
}

function simulateQueue(
  events: QueueEvent[],
  prSizeMap: Record<string, PRSize>,
  autoMergeSizes: Set<PRSize>,
) {
  const queues: Record<string, Set<string>> = {}
  const snapshots: { day: string; total: number }[] = []
  let lastDay: string | null = null

  for (const e of events) {
    const key = `${e.pr.repo}#${e.pr.number}`
    const size = prSizeMap[key] || 'M'
    const reviewer = e.reviewer

    if (autoMergeSizes.has(size)) continue

    if (!queues[reviewer]) queues[reviewer] = new Set()
    if (e.type === 'add') {
      queues[reviewer].add(key)
    } else {
      queues[reviewer].delete(key)
    }

    const day = e.time.slice(0, 10)
    if (day !== lastDay) {
      let total = 0
      for (const r in queues) total += queues[r].size
      snapshots.push({ day, total })
      lastDay = day
    }
  }

  return snapshots
}

function avgQueue(snapshots: { total: number }[]): number {
  if (snapshots.length === 0) return 0
  return snapshots.reduce((s, d) => s + d.total, 0) / snapshots.length
}

function main() {
  // Load data
  const sizesFile = path.join(DATA_DIR, 'pr-sizes.json')
  const eventsFile = path.join(OUTPUT_DIR, 'review-queue-events.json')

  if (!fs.existsSync(sizesFile)) {
    consola.error(`Data not found: ${sizesFile}`)
    consola.info('Run: pnpm tsx lab/fetch.ts --only sizes')
    process.exit(1)
  }
  if (!fs.existsSync(eventsFile)) {
    consola.error(`Events not found: ${eventsFile}`)
    consola.info('Run: pnpm tsx lab/experiments/001-queue-visualization.ts')
    process.exit(1)
  }

  const prs: PRSizeInfo[] = JSON.parse(fs.readFileSync(sizesFile, 'utf-8'))
  const reviewEvents: QueueEvent[] = JSON.parse(
    fs.readFileSync(eventsFile, 'utf-8'),
  )

  // 1. Classify
  const classified: ClassifiedPR[] = prs
    .filter((pr) => pr.mergedAt && pr.createdAt >= '2025-01-01')
    .map((pr) => ({
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      author: pr.author?.login,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      size: classifyPR(pr),
    }))

  // 2. Size distribution
  const sizeCounts: Record<PRSize, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0 }
  for (const pr of classified) sizeCounts[pr.size]++

  consola.info('=== PR Size Distribution (2025+) ===')
  consola.info(`Total: ${classified.length}`)
  for (const [size, count] of Object.entries(sizeCounts)) {
    const pct = ((count / classified.length) * 100).toFixed(1)
    consola.info(
      `  ${size.padEnd(3)} ${String(count).padStart(4)}  (${pct.padStart(5)}%)`,
    )
  }

  // 3. Build size map
  const prSizeMap: Record<string, PRSize> = {}
  for (const pr of classified) {
    prSizeMap[`${pr.repo}#${pr.number}`] = pr.size
  }

  // 4. Simulate
  const baseline = simulateQueue(reviewEvents, prSizeMap, new Set())
  const autoXS = simulateQueue(reviewEvents, prSizeMap, new Set(['XS']))
  const autoXSS = simulateQueue(reviewEvents, prSizeMap, new Set(['XS', 'S']))

  const baselineAvg = avgQueue(baseline)
  const xsAvg = avgQueue(autoXS)
  const xssAvg = avgQueue(autoXSS)

  consola.info('\n=== Auto Merge Simulation ===')
  consola.info(`Baseline avg queue:        ${baselineAvg.toFixed(1)}`)
  consola.info(
    `XS auto merge avg queue:   ${xsAvg.toFixed(1)} (${((1 - xsAvg / baselineAvg) * 100).toFixed(1)}% reduction)`,
  )
  consola.info(
    `XS+S auto merge avg queue: ${xssAvg.toFixed(1)} (${((1 - xssAvg / baselineAvg) * 100).toFixed(1)}% reduction)`,
  )

  // 5. Pickup time by size
  const pickupBySize: Record<PRSize, number[]> = {
    XS: [],
    S: [],
    M: [],
    L: [],
    XL: [],
  }
  for (const pr of classified) {
    const key = `${pr.repo}#${pr.number}`
    const addEvent = reviewEvents.find(
      (e) => e.type === 'add' && `${e.pr.repo}#${e.pr.number}` === key,
    )
    const removeEvent = reviewEvents.find(
      (e) => e.type === 'remove' && `${e.pr.repo}#${e.pr.number}` === key,
    )
    if (addEvent && removeEvent) {
      const hours =
        (new Date(removeEvent.time).getTime() -
          new Date(addEvent.time).getTime()) /
        3600000
      if (hours > 0 && hours < 720) {
        pickupBySize[pr.size].push(hours)
      }
    }
  }

  consola.info('\n=== Review Wait Time by Size (median hours) ===')
  for (const [size, times] of Object.entries(pickupBySize)) {
    if (times.length === 0) continue
    times.sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]
    const p75 = times[Math.floor(times.length * 0.75)]
    consola.info(
      `  ${size.padEnd(3)} n=${String(times.length).padStart(3)}  median=${median.toFixed(1)}h  p75=${p75.toFixed(1)}h`,
    )
  }

  // 6. Save
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const outputFile = path.join(OUTPUT_DIR, 'automerge-simulation-data.json')
  fs.writeFileSync(
    outputFile,
    JSON.stringify({
      sizeCounts,
      classified: classified.map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        size: pr.size,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
      })),
      simulation: {
        baseline: { snapshots: baseline, avgQueue: baselineAvg },
        autoXS: { snapshots: autoXS, avgQueue: xsAvg },
        autoXSS: { snapshots: autoXSS, avgQueue: xssAvg },
      },
      pickupBySize: Object.fromEntries(
        Object.entries(pickupBySize).map(([size, times]) => {
          times.sort((a, b) => a - b)
          return [
            size,
            {
              count: times.length,
              median:
                times.length > 0 ? times[Math.floor(times.length / 2)] : null,
              p75:
                times.length > 0
                  ? times[Math.floor(times.length * 0.75)]
                  : null,
              p90:
                times.length > 0 ? times[Math.floor(times.length * 0.9)] : null,
            },
          ]
        }),
      ),
    }),
  )
  consola.success(`Output: ${outputFile}`)
}

main()
