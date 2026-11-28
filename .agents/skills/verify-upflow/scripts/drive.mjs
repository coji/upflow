// upflow-verify drive から呼ばれる。直接は呼ばない。
// シナリオは `export default async (ctx) => { ... }` を持つ .mjs。ctx は下の `ctx` を参照。
import { chromium, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { query } from './db.mjs'

const { BASE_URL, DATA_DIR, EVIDENCE_DIR, E2E_ADMIN_EMAIL, PW_CHROMIUM_PATH } =
  process.env
const scenarioPath = process.argv[2]
if (!BASE_URL || !DATA_DIR || !EVIDENCE_DIR || !scenarioPath) {
  console.error('upflow-verify drive から呼んでください')
  process.exit(2)
}

mkdirSync(EVIDENCE_DIR, { recursive: true })
const steps = []
const consoleErrors = []
const pageErrors = []
let stepNo = 0

let browser
let page

const safe = (s) => s.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60)

/** 今の画面を証拠として残す: ARIA snapshot (YAML) とフルページの screenshot。 */
async function capture(name) {
  stepNo += 1
  const base = path.join(
    EVIDENCE_DIR,
    `${String(stepNo).padStart(2, '0')}-${safe(name)}`,
  )
  await page.waitForLoadState('networkidle').catch(() => {})
  writeFileSync(`${base}.aria.yml`, await page.locator('body').ariaSnapshot())
  await page.screenshot({ path: `${base}.png`, fullPage: true })
  steps.push({
    step: stepNo,
    name,
    url: page.url(),
    files: [`${base}.png`, `${base}.aria.yml`],
  })
  console.log(`captured ${stepNo} ${name} ${page.url()}`)
}

async function open() {
  browser = await chromium.launch(
    PW_CHROMIUM_PATH ? { executablePath: PW_CHROMIUM_PATH } : {},
  )
  // SSR は UTC で動く。ブラウザを JST にしておくと、日付境界のずれによる
  // hydration エラーが consoleErrors に出て見つかる。
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  })
  page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  return context
}

const ctx = {
  expect,
  baseURL: BASE_URL,
  evidenceDir: EVIDENCE_DIR,
  capture,
  /** 使い捨て DB を読み取り専用で引く。副作用の確認に使う。 */
  sql: (which, sqlText, params) => query(DATA_DIR, which, sqlText, params),
  /** 証拠に任意の JSON を残す (DB の行など)。 */
  record: (name, value) => {
    const file = path.join(EVIDENCE_DIR, `${safe(name)}.json`)
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
    steps.push({ step: stepNo, name, files: [file] })
  },
}

let ok = false
let error = null
try {
  const context = await open()
  Object.assign(ctx, { page, context })
  // seed の admin (owner, superadmin) でログインする。/test-login は / に redirect する。
  const res = await page.goto(
    `/test-login?email=${encodeURIComponent(E2E_ADMIN_EMAIL)}`,
  )
  if (!res?.ok()) throw new Error(`test-login failed: ${res?.status()}`)
  const scenario = await import(pathToFileURL(scenarioPath).href)
  await scenario.default(ctx)
  ok = true
} catch (e) {
  error = e instanceof Error ? (e.stack ?? e.message) : String(e)
  console.error(error)
  if (page) await capture('FAILED').catch(() => {})
} finally {
  const summary = {
    scenario: scenarioPath,
    baseURL: BASE_URL,
    ok,
    error,
    finishedAt: new Date().toISOString(),
    steps,
    consoleErrors,
    pageErrors,
  }
  writeFileSync(
    path.join(EVIDENCE_DIR, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
  await browser?.close()
  console.log(
    `${ok ? 'PASS' : 'FAIL'} evidence=${EVIDENCE_DIR} consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length}`,
  )
  process.exit(ok ? 0 : 1)
}
