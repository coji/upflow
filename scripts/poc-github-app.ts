/**
 * PoC: GitHub App Installation Token の動作検証
 *
 * 事前準備:
 * 1. テスト用 GitHub App を作成（contents, pull_requests, deployments: read）
 * 2. Private key を生成してダウンロード
 * 3. テスト org にインストール
 *
 * 実行:
 *   GITHUB_APP_ID=xxx \
 *   GITHUB_APP_PRIVATE_KEY_PATH=./path/to/key.pem \
 *   GITHUB_APP_INSTALLATION_ID=xxx \
 *   TEST_OWNER=xxx \
 *   TEST_REPO=xxx \
 *   pnpm tsx scripts/poc-github-app.ts
 */

import { createAppAuth } from '@octokit/auth-app'
import fs from 'node:fs'
import { Octokit } from 'octokit'

const appId = process.env.GITHUB_APP_ID
const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH
const installationId = process.env.GITHUB_APP_INSTALLATION_ID
const testOwner = process.env.TEST_OWNER
const testRepo = process.env.TEST_REPO

if (!appId || !privateKeyPath || !installationId) {
  console.error(
    'Required: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH, GITHUB_APP_INSTALLATION_ID',
  )
  process.exit(1)
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf-8')

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: Number(appId),
    privateKey,
    installationId: Number(installationId),
  },
})

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`✅ ${name}`)
  } catch (e) {
    console.error(`❌ ${name}`)
    console.error('  ', e instanceof Error ? e.message : String(e))
  }
}

async function main() {
  console.log('=== GitHub App PoC ===\n')

  // 1. Installation Token 取得確認
  await test('Installation Token の取得', async () => {
    const auth = createAppAuth({
      appId: Number(appId),
      privateKey,
      installationId: Number(installationId),
    })
    const result = await auth({ type: 'installation' })
    console.log(`   token prefix: ${result.token.substring(0, 10)}...`)
    console.log(`   expires: ${result.expiresAt}`)
  })

  // 2. リポジトリ一覧 (GET /installation/repositories)
  let repos: { owner: string; name: string }[] = []
  await test('GET /installation/repositories — リポ一覧', async () => {
    const res = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 10,
    })
    repos = res.data.repositories.map((r) => ({
      owner: r.owner.login,
      name: r.name,
    }))
    console.log(`   total: ${res.data.total_count}`)
    console.log(
      `   repos: ${repos.map((r) => `${r.owner}/${r.name}`).join(', ')}`,
    )
  })

  // 3. Search API (GET /search/repositories)
  const owner = testOwner || repos[0]?.owner
  if (owner) {
    await test(`Search API — user:${owner} のリポ検索`, async () => {
      const res = await octokit.rest.search.repos({
        q: `user:${owner}`,
        per_page: 5,
      })
      console.log(`   total: ${res.data.total_count}`)
      console.log(
        `   repos: ${res.data.items.map((r) => r.full_name).join(', ')}`,
      )
    })
  }

  // 以降のテストにはリポが必要
  const repoOwner = testOwner || repos[0]?.owner
  const repoName = testRepo || repos[0]?.name
  if (!repoOwner || !repoName) {
    console.log(
      '\n⚠️  テストリポが見つかりません。TEST_OWNER, TEST_REPO を指定してください。',
    )
    return
  }
  console.log(`\nテストリポ: ${repoOwner}/${repoName}\n`)

  // 4. GraphQL: PR 一覧 (GetPullRequestsQuery 相当)
  await test('GraphQL — PR 一覧取得', async () => {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: 5, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              title
              state
              createdAt
              updatedAt
              mergedAt
              additions
              deletions
              changedFiles
              author { login }
            }
          }
        }
      }
    `
    const res = await octokit.graphql<{
      repository: {
        pullRequests: {
          nodes: { number: number; title: string; state: string }[]
        }
      }
    }>(query, { owner: repoOwner, repo: repoName })
    const prs = res.repository.pullRequests.nodes
    console.log(`   PRs: ${prs.length}`)
    for (const pr of prs.slice(0, 3)) {
      console.log(`   #${pr.number} [${pr.state}] ${pr.title}`)
    }
  })

  // 5. GraphQL: タイムラインアイテム (DeployedEvent 含む)
  await test('GraphQL — タイムライン（DeployedEvent 含む）', async () => {
    const query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            pullRequests(first: 1, states: MERGED, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                number
                timelineItems(first: 20, itemTypes: [
                  REVIEW_REQUESTED_EVENT
                  REVIEW_REQUEST_REMOVED_EVENT
                  READY_FOR_REVIEW_EVENT
                  CONVERT_TO_DRAFT_EVENT
                  REVIEW_DISMISSED_EVENT
                  DEPLOYED_EVENT
                  CLOSED_EVENT
                  REOPENED_EVENT
                  MERGED_EVENT
                  HEAD_REF_FORCE_PUSHED_EVENT
                ]) {
                  nodes {
                    __typename
                    ... on ReviewRequestedEvent { createdAt }
                    ... on DeployedEvent { createdAt deployment { environment } }
                    ... on MergedEvent { createdAt }
                    ... on ClosedEvent { createdAt }
                  }
                }
              }
            }
          }
        }
      `
    const res = await octokit.graphql<{
      repository: {
        pullRequests: {
          nodes: {
            number: number
            timelineItems: { nodes: { __typename: string }[] }
          }[]
        }
      }
    }>(query, { owner: repoOwner, repo: repoName })
    const pr = res.repository.pullRequests.nodes[0]
    if (pr) {
      console.log(`   PR #${pr.number}`)
      const types = pr.timelineItems.nodes.map((n) => n.__typename)
      console.log(`   events: ${types.join(', ') || '(none)'}`)
    } else {
      console.log('   merged PR なし（スキップ）')
    }
  })

  // 6. GraphQL: コミット一覧
  await test('GraphQL — PR コミット一覧', async () => {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: 1, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              commits(first: 5) {
                nodes {
                  commit { oid committedDate committer { user { login } } }
                }
              }
            }
          }
        }
      }
    `
    const res = await octokit.graphql<{
      repository: {
        pullRequests: {
          nodes: {
            number: number
            commits: {
              nodes: { commit: { oid: string; committedDate: string } }[]
            }
          }[]
        }
      }
    }>(query, { owner: repoOwner, repo: repoName })
    const pr = res.repository.pullRequests.nodes[0]
    if (pr) {
      console.log(`   PR #${pr.number}: ${pr.commits.nodes.length} commits`)
    }
  })

  // 7. GraphQL: レビュー一覧
  await test('GraphQL — PR レビュー一覧', async () => {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: 1, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              reviews(first: 10) {
                nodes { state submittedAt author { login } }
              }
            }
          }
        }
      }
    `
    const res = await octokit.graphql<{
      repository: {
        pullRequests: {
          nodes: {
            number: number
            reviews: {
              nodes: { state: string; author: { login: string } }[]
            }
          }[]
        }
      }
    }>(query, { owner: repoOwner, repo: repoName })
    const pr = res.repository.pullRequests.nodes[0]
    if (pr) {
      console.log(`   PR #${pr.number}: ${pr.reviews.nodes.length} reviews`)
    }
  })

  // 8. REST: PR ファイル一覧
  await test('REST — PR ファイル一覧 (pulls.listFiles)', async () => {
    // 最新 PR の番号を取得
    const prs = await octokit.rest.pulls.list({
      owner: repoOwner,
      repo: repoName,
      state: 'all',
      per_page: 1,
    })
    if (prs.data.length === 0) {
      console.log('   PR なし（スキップ）')
      return
    }
    const prNumber = prs.data[0].number
    const files = await octokit.rest.pulls.listFiles({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
      per_page: 5,
    })
    console.log(`   PR #${prNumber}: ${files.data.length} files`)
    for (const f of files.data.slice(0, 3)) {
      console.log(`   ${f.filename} (+${f.additions}/-${f.deletions})`)
    }
  })

  // 9. GraphQL: タグ一覧
  await test('GraphQL — タグ一覧', async () => {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          refs(refPrefix: "refs/tags/", first: 5, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
            nodes {
              name
              target {
                __typename
                ... on Commit { oid committedDate }
                ... on Tag { target { ... on Commit { oid committedDate } } tagger { date } }
              }
            }
          }
        }
      }
    `
    const res = await octokit.graphql<{
      repository: {
        refs: { nodes: { name: string; target: { __typename: string } }[] }
      }
    }>(query, { owner: repoOwner, repo: repoName })
    const tags = res.repository.refs.nodes
    console.log(`   tags: ${tags.length}`)
    for (const t of tags.slice(0, 3)) {
      console.log(`   ${t.name} (${t.target.__typename})`)
    }
  })

  console.log('\n=== PoC 完了 ===')
}

main().catch(console.error)
