# Remote MCP Server 設計

## 目的

Upflow が保持する開発生産性データを、テナントが利用する Claude / ChatGPT などの LLM から利用可能にする。認証前提で、ボトルネック特定や開発フロー分析を LLM 経由で行えるようにする。

## 提供チャネル

```
┌─────────┐  ┌────────────┐  ┌──────────┐
│  CLI    │  │ MCP Server │  │ GPTs     │
│(Claude  │  │(Claude Web)│  │(ChatGPT) │
│ Code)   │  │            │  │          │
└────┬────┘  └─────┬──────┘  └────┬─────┘
     │             │              │
     └──────┬──────┴──────────────┘
            │
     ┌──────▼──────┐
     │  HTTP API   │  ← resource routes で実装
     └──────┬──────┘
            │
     ┌──────▼──────┐
     │  Tenant DB  │
     └─────────────┘
```

- **Remote MCP Server**: Streamable HTTP で MCP ツール提供（Claude Web 等向け）— **偵察で E2E 動作確認済み**
- **CLI**: API を叩く薄いクライアント（Claude Code ユーザー向け、将来）
- **GPTs Actions**: OpenAPI スキーマを公開（ChatGPT 向け、将来）

## 技術スタック（確定）

| 項目               | 選定                                                        | バージョン                       |
| ------------------ | ----------------------------------------------------------- | -------------------------------- |
| MCP トランスポート | `WebStandardStreamableHTTPServerTransport`                  | @modelcontextprotocol/sdk 1.27.1 |
| MCP Server         | `McpServer`                                                 | 同上                             |
| OAuth AS           | `@better-auth/oauth-provider` (`oauthProvider`)             | 1.5.5                            |
| JWT                | `better-auth/plugins/jwt`                                   | better-auth 1.5.5                |
| トークン検証       | `verifyAccessToken` from `better-auth/oauth2`               | 同上                             |
| `.well-known`      | `oauthProviderAuthServerMetadata` + 自前 protected-resource | 同上                             |
| エンドポイント     | React Router v7 resource route                              | `/api/mcp`                       |

**注意**: `oidcProvider`（`better-auth/plugins/oidc-provider`）は非推奨。`@better-auth/oauth-provider` が後継。`mcp` プラグインも `oidcProvider` ベースのため将来 `oauthProvider` に移行予定。

## 認証・認可

### アーキテクチャ（MCP 仕様 2025-06-18 改訂準拠・E2E 検証済み）

```
┌──────────┐     ①発見      ┌──────────────────┐
│  Claude  │ ──────────────→ │  /.well-known/   │
│  Web等   │     GET         │  (手動ルート)    │
│          │ ←─────────────── │                  │
│          │  AS情報         └──────────────────┘
│          │
│          │     ②認可       ┌──────────────────┐
│          │ ──────────────→ │  /api/auth/      │
│          │  OAuth 2.1 +    │  oauth2/         │
│          │  PKCE + consent │  (better-auth    │
│          │ ←─────────────── │   oauthProvider) │
│          │  access_token   └──────────────────┘
│          │
│          │     ③MCP呼出    ┌──────────────────┐
│          │ ──────────────→ │  /api/mcp        │
│          │  Bearer token   │  (resource route) │
│          │ ←─────────────── │  Streamable HTTP │
└──────────┘  SSE response   └──────────────────┘
```

### OAuth フロー（E2E 検証済み）

1. **Dynamic Client Registration** — `POST /api/auth/oauth2/register`（`token_endpoint_auth_method: "none"` で public client）
2. **Authorization** — `GET /api/auth/oauth2/authorize` + PKCE → ログイン（GitHub OAuth）→ consent 画面
3. **Consent** — `POST /api/auth/oauth2/consent` に JSON（`{ accept, scope, oauth_query }` ）→ `{ url }` を JSON で返す → クライアントが `window.location.href` でリダイレクト
4. **Token Exchange** — `POST /api/auth/oauth2/token`（`Content-Type: application/x-www-form-urlencoded`）で code + PKCE verifier + **`resource` パラメータ** → **JWT access_token** 取得
5. **MCP 呼出** — `POST /api/mcp` に `Authorization: Bearer <JWT>` + `Accept: application/json, text/event-stream`

**重要**: `resource` パラメータを token exchange に含めないと opaque token が返る。JWT を得るには `resource` が必須で、その値は `oauthProvider({ validAudiences: [...] })` に登録されている必要がある。

### better-auth プラグイン構成（実装済み）

| 要件                           | プラグイン                               | 備考                                                  |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------- |
| OAuth 2.1 Provider             | `@better-auth/oauth-provider`            | 認可コード・JWT トークン発行                          |
| JWT 署名・検証                 | `better-auth/plugins/jwt`                | `oauthProvider` が依存                                |
| PKCE (S256)                    | `oauthProvider` に含まれる               | デフォルトで必須                                      |
| Dynamic Client Registration    | `oauthProvider` に含まれる               | `allowDynamicClientRegistration: true`                |
| Public Client 対応             | `oauthProvider` が自動判定               | `token_endpoint_auth_method: "none"` → `public: true` |
| Consent 画面                   | 自前実装 (`/oauth/consent`)              | `consentPage: '/oauth/consent'`                       |
| Token Introspection/Revocation | `oauthProvider` に含まれる               | `/oauth2/introspect`, `/oauth2/revoke`                |
| JWT access token               | `validAudiences` + `resource` パラメータ | token exchange 時に `resource` 指定で JWT 発行        |

### トークン検証（実装済み）

JWT ベースの `verifyAccessToken` を使用。**`jwksUrl` の指定が必須**:

```typescript
import { verifyAccessToken } from 'better-auth/oauth2'

const payload = await verifyAccessToken(token, {
  jwksUrl: `${origin}/api/auth/jwks`,
  verifyOptions: {
    issuer: `${origin}/api/auth`, // iss は /api/auth 付き
    audience: origin, // aud は origin のみ
  },
})
// payload.sub → userId
```

**注意点**:

- `jwksUrl` を省略すると JWKS 検証が行われず常に失敗する
- `issuer` は `${origin}/api/auth`（better-auth の basePath 付き）
- `audience` は `${origin}`（`validAudiences` に登録した値）

### テナントスコープ（暫定）

- token から `userId` → `members` テーブルでユーザーの最初の org を取得
- **TODO**: OAuth scope に `org:{orgId}` を含めて明示的にスコープ指定

## ファイル構成（実装済み）

```
app/
├── libs/
│   └── auth.server.ts              # oidcProvider プラグイン追加済み
├── routes/
│   ├── api.auth.$.ts               # 既存（better-auth handler — OAuth エンドポイント含む）
│   ├── api.mcp.ts                  # MCP Streamable HTTP エンドポイント
│   └── oauth.consent.tsx           # OAuth consent 画面
├── routes.ts                       # 手動ルート定義 + autoRoutes
├── well-known-routes/              # .well-known（autoRoutes の外に配置）
│   ├── oauth-protected-resource.ts
│   └── oauth-authorization-server.ts
├── services/
│   ├── mcp/
│   │   ├── server.ts               # McpServer インスタンス生成・tool 登録
│   │   └── well-known.ts           # .well-known レスポンス生成（静的 JSON）
│   ├── tenant-db.server.ts         # 既存
│   └── db.server.ts                # 既存
db/
└── schema.sql                      # oauth_application, oauth_access_token, oauth_consent 追加済み
```

## 偵察で判明した課題と解決策

| #   | 課題                                                             | 解決策                                                                                 | 状態       |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| 1   | auto-routes はドットで始まるファイルを無視                       | `routes.ts` で手動ルート定義                                                           | 解決済み   |
| 2   | `routes/` 内に手動ルートのファイルを置くと重複エラー             | `app/well-known-routes/` に配置                                                        | 解決済み   |
| 3   | `oidcProvider` のテーブル名は camelCase で探す                   | `schema` オプションで snake_case マッピング                                            | 解決済み   |
| 4   | `db:setup` は Atlas マイグレーション経由                         | schema.sql 変更 + マイグレーション作成が必要                                           | **要対応** |
| 5   | `createMcpAuthClient.discoveryHandler()` がハングする            | 自前で静的 JSON レスポンス                                                             | 解決済み   |
| 6   | `verifyToken('')` がハングする                                   | 空 token は早期 return                                                                 | 解決済み   |
| 7   | `consentPage` 未設定だとエラー                                   | `consentPage: '/oauth/consent'` + ページ実装                                           | 解決済み   |
| 8   | consent エンドポイントは JSON のみ受付                           | HTML form → `fetch` で JSON POST に変更                                                | 解決済み   |
| 9   | consent レスポンスが 302 ではなく JSON                           | `data.redirectURI` で `window.location.href`                                           | 解決済み   |
| 10  | `createMcpAuthClient.verifyToken()` が oidcProvider と非互換     | `oauthProvider` + `verifyAccessToken` に移行で解決                                     | 解決済み   |
| 11  | MCP SDK が `Accept` ヘッダーを要求                               | MCP クライアントが自動付与（curl テスト時のみ手動指定）                                | 仕様通り   |
| 12  | Dynamic Client Registration で全て `type: "web"` になる          | `oauthProvider` で解決。`token_endpoint_auth_method: "none"` → `public: true` 自動判定 | 解決済み   |
| 13  | OAuth テーブルの Atlas マイグレーション未作成                    | 本番デプロイ前に作成                                                                   | **要対応** |
| 14  | org スコープが OAuth token に含まれない                          | ユーザーの最初の org を暫定使用。scope 設計が必要                                      | **要対応** |
| 15  | `oidcProvider` は非推奨                                          | `@better-auth/oauth-provider` に移行                                                   | 解決済み   |
| 16  | `oauthProvider` は `session.storeSessionInDatabase: true` が必要 | session 設定に追加                                                                     | 解決済み   |
| 17  | `resource` なしだと opaque token が返る                          | `validAudiences` 設定 + token exchange で `resource` 指定                              | 解決済み   |
| 18  | `verifyAccessToken` に `jwksUrl` が必須                          | `${origin}/api/auth/jwks` を明示指定                                                   | 解決済み   |
| 19  | `iss` が `origin/api/auth` (basePath 付き)                       | `verifyOptions.issuer` を合わせる                                                      | 解決済み   |
| 20  | token endpoint は `application/x-www-form-urlencoded` のみ       | OAuth 2.1 仕様準拠（JSON 不可）                                                        | 仕様通り   |
| 21  | consent レスポンスが `{ url }` で返る（`redirect_uri` ではない） | `data.url` でリダイレクト                                                              | 解決済み   |
| 22  | `jwt` プラグインが `jwks` テーブルを必要とする                   | DB に追加 + schema.sql 更新                                                            | 解決済み   |

## データ資産

| カテゴリ       | データ                                                         | 粒度         |
| -------------- | -------------------------------------------------------------- | ------------ |
| サイクルタイム | coding / pickup / review / deploy time                         | PR単位・日数 |
| PR メタデータ  | author, reviewers, size(additions/deletions), repository, team | PR単位       |
| LLM分類        | complexity (XS〜XL), riskAreas, complexityReason               | PR単位       |
| レビュー履歴   | reviewer, state, requestedAt, reviewedAt                       | レビュー単位 |
| チーム構成     | teams, team_members, repos↔team mapping, personalLimit         | 組織単位     |
| 生データ       | GitHub API raw responses (commits, timeline, discussions)      | PR単位JSON   |
| フィードバック | LLM分類の修正ログ                                              | PR単位       |

## 分析フレームワーク（ToC + コーディングエージェント時代）

### Layer 1: フロー効率分析（既存データで即座に可能）

- **ボトルネックステージ特定**: coding / pickup / review / deploy のどこが最も時間を消費しているか。チーム別・リポジトリ別・期間別にドリルダウン
- **WIP とスループットの相関**: Little's Law（リードタイム = WIP ÷ スループット）。WIP増加でリードタイムが指数的に悪化するポイントの特定
- **バッチサイズ効果**: complexity / PR size とサイクルタイムの相関。XL PR がパイプラインを詰まらせている度合いの定量化
- **レビューキュー滞留**: pickup time の分布（p50/p75/p90）。特定レビュワーへの集中度

### Layer 2: エージェント時代特有の分析

- **Human vs Bot PR の区別と比較**: エージェント生成 PR vs 人間 PR のメトリクス比較。エージェント PR のレビュー負荷（pickup/review time の変化）
- **レビューボトルネックの深刻化検知**: PR生成速度 > レビュー消化速度の検知。レビュワーあたりの負荷トレンド
- **コンテキストスイッチコスト推定**: 1人が同時に抱えるオープン PR 数とレビュー時間の相関。personalLimit の最適値の示唆

### Layer 3: 戦略的インサイト（raw データの深掘り）

- **レビュー品質シグナル**: CHANGES_REQUESTED 率 vs 即 APPROVED 率。レビューラウンド数。ラバースタンプレビューの検知
- **デプロイ頻度とバッチデプロイの検知**: releasedAt の間隔分布。1リリースに含まれる PR 数
- **リスクエリア集中分析**: 特定 riskArea への変更集中（潜在的技術的負債）。complexity フィードバックの乖離（LLM 見積もり精度）

## MCP Tool 一覧

### 実装済み

| Tool                     | 説明                                 | 主な引数 |
| ------------------------ | ------------------------------------ | -------- |
| `get_cycle_time_summary` | ステージ別サイクルタイム統計（平均） | period   |

### 実装予定

| Tool                             | 説明                                   | 主な引数                                  |
| -------------------------------- | -------------------------------------- | ----------------------------------------- |
| `get_bottleneck_stage`           | 最も時間を消費しているステージ特定     | team?, repo?, period                      |
| `get_wip_throughput_correlation` | WIP数とスループットの関係              | team?, period                             |
| `get_pr_size_distribution`       | complexity別のPR数と平均サイクルタイム | team?, repo?, period                      |
| `get_slow_prs`                   | 閾値超えPRリストと滞留ステージ         | team?, repo?, period, threshold_days?     |
| `get_pr_details`                 | 個別PRのタイムライン詳細               | pr_number, repo                           |
| `get_review_workload`            | レビュワー別の負荷                     | team?, period                             |
| `get_review_quality_signals`     | CHANGES_REQUESTED率、即承認率          | team?, repo?, period                      |
| `get_pending_reviews`            | レビュー待ちPRとキュー滞留時間         | team?                                     |
| `get_metric_trend`               | 週次/月次のメトリクス推移              | metric, team?, repo?, period, granularity |
| `get_deployment_frequency`       | デプロイ頻度と1リリースPR数            | repo?, period                             |

## 次のステップ

1. **Atlas マイグレーション作成** — `oauth_application`, `oauth_access_token`, `oauth_consent` テーブル
2. **OAuth scope に org を含める** — authorize 時に org 選択 or scope 指定
3. **MCP Tool 追加実装** — bottleneck, reviews, trends 等
4. **consent 画面の改善** — client_name 表示、スコープ説明
5. **Claude Web からの接続テスト** — 実際の MCP クライアントでの E2E 確認
6. **CLI 実装** — API を叩く薄いクライアント（npx で配布）

## 未決事項

- エージェント生成 PR の識別方法（bot flag / commit message パターン / label）
- OAuth scope 設計（org 単位 / read-only / read-write）
- rate limiting の要否
- consent 画面で client_name 等の表示改善（`authClient.oauth2.publicClient()` で取得可能）
