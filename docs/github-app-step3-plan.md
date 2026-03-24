# Step 3: Webhook + Setup callback + Installation 紐付け

> 正本: `docs/github-app-phase2-plan.md`、全体ステップ: `docs/github-app-impl-steps.md`
>
> `feat/github-app-migration` ブランチで作業。Step 2（Octokit factory + fetcher リファクタ）は完了済み。

## 目的

GitHub App のインストール・アンインストール・サスペンドを安全に処理するバックエンドを構築する。

## コードベースの前提（調査済み）

- **raw body**: Express は `express.json()` をグローバルに使っていない。`request.text()` で raw body を取得可能。追加ミドルウェア不要
- **API ルートパターン**: `api.auth.$.ts`, `api.durably.$.ts` が既存。`api.github.webhook.ts` / `api.github.setup.ts` で同じパターン
- **org middleware**: `$orgSlug/_layout.tsx` で `orgMemberMiddleware` が適用される。`api.*` ルートはこの外なので認証不要
- **キャッシュ**: `clearOrgCache(orgId)` が `app/services/cache.server.ts` にある。in-memory Map ベース
- **App JWT**: setup callback で `GET /app/installations/:id` を叩くには installation token ではなく app-level JWT が必要。`createAppAuth({ appId, privateKey })` で `{ type: 'app' }` を指定

## スコープ外（Step 4 で対応）

- 設定画面の UI 変更（「インストール」「URL コピー」ボタン等）
- リポ追加画面の App 対応
- 本番 App の permissions 追加

---

## 実装手順

### 3-0. 共有クエリの整理（Step 2 からの持ち越し）

`getIntegration` / `getGithubAppLink` が複数ルートの `+functions/queries.server.ts` に散在し、cross-route import が発生している。

**やること**:

1. `app/services/github-integration-queries.server.ts` を新規作成
2. 以下の関数を移動:
   - `getIntegration(organizationId)` — `_index/+functions/queries.server.ts` から
   - `getGithubAppLink(organizationId)` — 同上
3. 以下の重複を削除し、共通モジュールを import:
   - `app/routes/$orgSlug/settings/repositories/$repository/settings/+functions/queries.server.ts` の `getIntegration`
   - `app/routes/$orgSlug/settings/repositories.add/+functions/queries.server.ts` の `getIntegration`（ここは integration + repositories を組み合わせて返しているので、共通の `getIntegration` を使い repositories は別途取得に変更）
4. 全 import 先を更新:
   - `app/routes/$orgSlug/settings/integration/index.tsx`
   - `app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts`
   - `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`
   - `app/services/github-octokit.server.ts`（import していないが、Step 3-4 で使うので先に共通化）

**`batch/db/queries.ts` は触らない** — batch は独自の一括取得関数（`getAllIntegrations`, `getAllGithubAppLinks`）を持っており、依存方向が逆。

> **コミット方針**: 3-0 は Step 3 本体（webhook/setup）とは独立した整理作業。**先にこれだけで `pnpm validate` を通してコミット**してから 3-1 以降に進む。差分レビューと不具合切り分けが楽になる。

---

### 3-1. Nonce テーブル追加

`db/shared.sql` に追加:

```sql
CREATE TABLE github_app_install_states (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CONSTRAINT github_app_install_states_org_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);
```

- `pnpm db:migrate` でマイグレーション生成
- `pnpm db:apply && pnpm db:generate` で型生成

---

### 3-2. Webhook 署名検証

**ファイル**: `app/libs/webhook-verify.server.ts`（新規）

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  // 1. 'sha256=' prefix を確認
  // 2. HMAC-SHA256 を計算（GITHUB_WEBHOOK_SECRET）
  // 3. timingSafeEqual で比較
}
```

**実装要件**:

- `sha256=` prefix がなければ即 reject
- `crypto.timingSafeEqual` を使用（タイミング攻撃防止）
- Buffer の長さが異なる場合も reject（`timingSafeEqual` は同じ長さが前提）

**テスト**: `app/libs/webhook-verify.server.test.ts`

- 正常署名 → true
- `sha256=` prefix なし → false
- body 改変 → false
- secret 不一致 → false

---

### 3-3. State トークン

**ファイル**: `app/libs/github-app-state.server.ts`（新規）

```typescript
export async function generateInstallState(
  organizationId: string,
): Promise<string>

export async function consumeInstallState(
  nonce: string,
): Promise<{ organizationId: string }>
```

**state 形式**: nonce（UUID）のみ。署名は不要。

> **設計判断**: 以前の設計では HMAC 署名付き state に orgId/expiry を埋め込んでいたが、簡素化した。DB に nonce + organizationId + expiresAt を持つので、署名なしでも同等の機能が実現できる。防御層は1枚減る（DB 到達前にゴミリクエストを弾けない）が、UUID は推測不能で DB lookup は UNIQUE index の sub-millisecond クエリなので実害はない。専用 secret の env var も不要。

**`generateInstallState`**:

1. `crypto.randomUUID()` で nonce 生成
2. expiresAt = 現在 + 7日（ISO 8601）
3. `github_app_install_states` テーブルに INSERT（`id: nanoid()`, `organizationId`, `nonce`, `expiresAt`）
4. nonce 文字列をそのまま返す（これが GitHub に渡す `state` パラメータ）

**`consumeInstallState`**（setup callback のトランザクション内で呼ぶ）:

1. `github_app_install_states` を `nonce` で検索
2. `consumedAt IS NULL` かつ `expiresAt > NOW()` を確認
3. `consumedAt` を設定して消費済みにする
4. `{ organizationId }` を返す
5. 見つからない / 消費済み / 期限切れ → エラー

**テスト**: `app/libs/github-app-state.server.test.ts`

- 生成 → 消費 → organizationId 取得成功
- expired nonce → reject
- 存在しない nonce → reject
- 消費済み nonce の再利用 → reject

---

### 3-4. Webhook エンドポイント

**ファイル**: `app/routes/api.github.webhook.ts`（新規）

```typescript
import type { Route } from './+types/api.github.webhook'

export const action = async ({ request }: Route.ActionArgs) => {
  const rawBody = await request.text()
  const signature = request.headers.get('X-Hub-Signature-256') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const event = request.headers.get('X-GitHub-Event')
  const action = payload.action

  // イベント分岐（db.transaction() 内で実行）
}
```

**イベント分岐**:

| `X-GitHub-Event`            | `action`    | 処理                                                                                                                                                 |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `installation`              | `created`   | `github_app_links` を `installation_id` or `github_account_id` で検索。あれば `app_repository_selection` 更新 + `github_org` 更新（org rename 追従） |
| `installation`              | `deleted`   | `github_app_links` を soft delete（`deleted_at` 設定）+ `clearOrgCache`                                                                              |
| `installation`              | `suspend`   | `integrations.appSuspendedAt` を設定（`github_app_links.organization_id` で tenant 特定）                                                            |
| `installation`              | `unsuspend` | `integrations.appSuspendedAt` を NULL に                                                                                                             |
| `installation_repositories` | —           | `app_repository_selection` 更新 + `clearOrgCache`                                                                                                    |
| その他                      | —           | `return new Response(null, { status: 202 })`                                                                                                         |

**注意**:

- **全 shared DB 更新は `db.transaction()` 内で実行**
- `installation.created` で link が 0 件 → ログのみ（エラーにしない。setup callback でリンク済みか、まだ未接続の正常ケース）
- `suspend`/`unsuspend` は `github_app_links.organization_id` → `integrations` の `organizationId` で tenant を特定
- webhook payload の型: `@octokit/webhooks-types` パッケージを使うか、必要なフィールドだけ手動で型定義

**テスト**: `app/routes/api.github.webhook.test.ts`（各イベントの正常系。DB 操作の検証）

---

### 3-5. Setup URL callback

**ファイル**: `app/routes/api.github.setup.ts`（新規）

```typescript
import type { Route } from './+types/api.github.setup'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url)
  const installationId = url.searchParams.get('installation_id')
  const state = url.searchParams.get('state')

  // 1. パラメータ検証（installation_id, state 必須）
  // 2. GitHub API 検証（createAppOctokit() で GET /app/installations/:id）
  // 3. トランザクション（nonce 消費 + link UPSERT + integration UPSERT）
  // 4. clearOrgCache
  // 5. リダイレクト
}
```

**App JWT で GitHub API を叩く方法**:

`github-octokit.server.ts` に `createAppOctokit()` ヘルパーを追加（`createOctokit` と base64 デコード等のロジックを共有）:

```typescript
// github-octokit.server.ts に追加
export function createAppOctokit(): Octokit {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = Buffer.from(
    process.env.GITHUB_APP_PRIVATE_KEY ?? '',
    'base64',
  ).toString('utf-8')
  invariant(
    appId && privateKey,
    'GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required',
  )
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId: Number(appId), privateKey },
  })
}
```

使用:

```typescript
const appOctokit = createAppOctokit()
// App JWT で認証（installation token ではない）
const { data: installation } = await appOctokit.rest.apps.getInstallation({
  installation_id: Number(installationId),
})
```

**トランザクション内の処理**:

```typescript
// 1. nonce 消費（トランザクション外。失敗時はユーザーが新しい state を生成して再試行）
const { organizationId } = await consumeInstallState(state)

// 2. link + integration を原子的に更新
await db.transaction().execute(async (trx) => {
  // github_app_links UPSERT
  await trx
    .insertInto('githubAppLinks')
    .values({
      organizationId,
      installationId: installation.id,
      githubAccountId: installation.account.id,
      githubOrg: installation.account.login,
      appRepositorySelection: installation.repository_selection ?? 'all',
      deletedAt: null,
    })
    .onConflict((oc) =>
      oc.column('organizationId').doUpdateSet({
        installationId: installation.id,
        githubAccountId: installation.account.id,
        githubOrg: installation.account.login,
        appRepositorySelection: installation.repository_selection ?? 'all',
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      }),
    )
    .execute()

  // 3. integrations UPSERT（新規 org で integration 行がない場合にも対応）
  await trx
    .insertInto('integrations')
    .values({
      id: nanoid(),
      organizationId,
      provider: 'github',
      method: 'github_app',
      appSuspendedAt: null,
    })
    .onConflict((oc) =>
      oc.column('organizationId').doUpdateSet({
        method: 'github_app',
        appSuspendedAt: null,
      }),
    )
    .execute()
})
```

**リダイレクト仕様**:

1. ログイン済み + org にアクセス可能 → `/:orgSlug/settings/integration`
2. ログイン済み + org にアクセス不可 → `/`
3. 未ログイン → リンクは完了（state で認証済み）→ `/login`

ログイン状態の確認: `auth.api.getSession({ headers: request.headers })` を使用（実コードでは `auth.api.getSession(request)` の形式もあるので、`app/libs/auth.server.ts` の既存パターンに合わせる）。org アクセス可能かは `organizationId` から shared DB の `organizations.slug` + `members` テーブルで判断。

**注意**: setup callback 成功後に **`clearOrgCache(organizationId)`** を必ず呼ぶこと。リポ追加画面等で GitHub API の一覧取得結果がキャッシュされているため、認証方式が変わった後にキャッシュが残ると古い認証でリクエストが飛ぶ。

---

### 3-6. 接続解除 action

`app/routes/$orgSlug/settings/integration/index.tsx` の action を変更。

**現在の action 構造**: `integrationSettingsSchema` を `parseWithZod` してから処理している。`disconnect-github-app` は schema が異なるので、**先に `formData.get('intent')` で intent を分岐**し、既存の token 更新フローと disconnect を分ける。

```typescript
export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  // disconnect は独自の処理（既存の parseWithZod フローとは別）
  if (intent === 'disconnect-github-app') {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('githubAppLinks')
        .set({ deletedAt: new Date().toISOString() })
        .where('organizationId', '=', organization.id)
        .where('deletedAt', 'is', null)
        .execute()

      await trx
        .updateTable('integrations')
        .set({ method: 'token' })
        .where('organizationId', '=', organization.id)
        .execute()
    })
    clearOrgCache(organization.id)
    return dataWithSuccess({}, { message: 'GitHub App disconnected' })
  }

  // 既存の token 更新フロー
  const submission = await parseWithZod(formData, { schema })
  // ...
}
```

**PAT 有無による挙動**:

- PAT あり → `method='token'` で即座に動作再開
- PAT なし → UI は「未接続 + PAT なし」状態（PAT 入力を促す）

---

### 3-7. Batch の 403/404 暫定対応

`app/services/jobs/crawl.server.ts` の per-repo fetch ステップで、GitHub API の 403/404 をキャッチしてスキップ + ログ出力する。

現在の crawl.server.ts L105-136 の try-catch は既にある（`step.log.warn` で失敗ログ → `{ saved: false }`）。これで暫定対応は十分。追加変更は不要の可能性が高い。確認して、もし 403/404 で retry が走る等の問題があれば対応。

---

### 3-8. `.env.example` 追加

```
GITHUB_WEBHOOK_SECRET=       # Webhook 署名検証用
```

---

### 3-9. テスト一覧

**Webhook 署名検証** (`app/libs/webhook-verify.server.test.ts`):

- 正常署名 → true
- `sha256=` prefix なし → false
- body 改変 → false
- secret 不一致 → false

**State トークン** (`app/libs/github-app-state.server.test.ts`):

- 生成 → 消費 → organizationId 取得成功
- expired nonce → reject
- 存在しない nonce → reject
- 消費済み nonce の再利用 → reject

**Setup callback** (`app/routes/api.github.setup.test.ts` or 結合テスト):

- 正常フロー: state 有効 + installation 有効 → link 作成 + method 切替（トランザクション）
- nonce 消費済み → reject
- 同一 org + 同一 installation の再実行 → 成功（UPSERT で冪等）
- 別 org に既存 installation を結び直そうとした → UNIQUE 制約エラー
- 無効な installation_id → GitHub API エラー → エラーレスポンス（nonce 未消費）
- soft delete 済み link の復活（deletedAt が NULL に戻る）
- state パラメータ欠落 → エラーレスポンス
- installation_id パラメータ欠落 → エラーレスポンス
- integration 行がない新規 org → UPSERT で integration 作成 + method 切替

**Webhook エンドポイント** (`app/routes/api.github.webhook.test.ts`):

- 署名検証失敗 → 401
- malformed JSON body → エラーレスポンス
- `installation.created`: link あり → `app_repository_selection` 更新 + org rename 追従
- `installation.created`: link なし → ログのみ（エラーにしない）
- `installation.deleted`: soft delete + `clearOrgCache`
- `installation.suspend` / `unsuspend`: `appSuspendedAt` 更新
- `installation_repositories`: `app_repository_selection` 更新
- 未知のイベント → 202

**接続解除**:

- soft delete + method 復帰（トランザクション）
- PAT なし時の振る舞い

---

## 検証

```bash
pnpm validate  # lint, format, typecheck, build, test 全パス
```

Webhook delivery のテストは本番 App 設定後に手動で確認（3-6 の手動作業後）。
