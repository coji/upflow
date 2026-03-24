/**
 * PoC: リポジトリ追加画面で使う API が Installation Token で動くか検証
 */
import { createAppAuth } from '@octokit/auth-app'
import fs from 'node:fs'
import { Octokit } from 'octokit'

const privateKey = fs.readFileSync(
  process.env.GITHUB_APP_PRIVATE_KEY_PATH!,
  'utf-8',
)
const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: Number(process.env.GITHUB_APP_ID),
    privateKey,
    installationId: Number(process.env.GITHUB_APP_INSTALLATION_ID),
  },
})

async function main() {
  // Test 1: GET /user/repos (現在のリポ追加画面が使ってる API)
  console.log('=== GET /user/repos (PAT用、App で動くか?) ===')
  try {
    const res = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 5,
      affiliation: 'owner,collaborator,organization_member',
    })
    console.log('✅ 動いた:', res.data.length, 'repos')
    for (const r of res.data) console.log('  ', r.full_name)
  } catch (e: any) {
    console.log('❌ 失敗:', e.status, e.message?.substring(0, 200))
  }

  // Test 2: GET /installation/repositories (App 用の代替)
  console.log('\n=== GET /installation/repositories (App用の代替) ===')
  try {
    const res = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    })
    console.log('✅ 動いた:', res.data.total_count, 'repos')
    for (const r of res.data.repositories.slice(0, 5))
      console.log('  ', r.full_name)

    // owner 抽出（getUniqueOwners の代替）
    const owners = [...new Set(res.data.repositories.map((r) => r.owner.login))]
    console.log('  → owners:', owners.join(', '))
  } catch (e: any) {
    console.log('❌ 失敗:', e.status, e.message?.substring(0, 200))
  }

  // Test 3: Search API (現在のリポ検索)
  console.log('\n=== Search API (キーワード検索) ===')
  try {
    const res = await octokit.rest.search.repos({
      q: 'user:techtalkjp',
      per_page: 5,
    })
    console.log('✅ 動いた:', res.data.total_count, 'repos')
    for (const r of res.data.items.slice(0, 5)) console.log('  ', r.full_name)
  } catch (e: any) {
    console.log('❌ 失敗:', e.status, e.message?.substring(0, 200))
  }

  // Test 4: Search API でインストール外のリポが見えないか確認
  console.log('\n=== Search API (スコープ外 org の検索) ===')
  try {
    const res = await octokit.rest.search.repos({
      q: 'user:facebook react',
      per_page: 3,
    })
    if (res.data.total_count > 0) {
      console.log(
        '⚠️  スコープ外のリポが見える:',
        res.data.total_count,
        'repos',
      )
      for (const r of res.data.items.slice(0, 3)) console.log('  ', r.full_name)
      console.log(
        '  → Search API は Installation Token でもスコープされない。GET /installation/repositories + フィルタが必要',
      )
    } else {
      console.log('✅ スコープ外のリポは見えない')
    }
  } catch (e: any) {
    console.log('❌ 失敗:', e.status, e.message?.substring(0, 200))
  }
}

main().catch(console.error)
