# GitHub App 移行計画

## 背景・課題

現状、各クライアント org のデータ収集に個人の GitHub PAT (Fine-grained Token) を使用している。

**問題**: クライアントに owner/admin 権限を付与してユーザー管理・チーム設定を移譲したいが、リポジトリ追加画面で PAT がアクセスできる **他の org のリポジトリも見えてしまう**。トークンのスコープが org をまたいでいるため、UI レベルのフィルタリングでは本質的な解決にならない。

**解決方針**: 既存の GitHub App「upflow-team」を拡張し、ログイン認証とデータ収集を1つの App で統一する。Installation Token によりトークンレベルで org 単位の隔離を実現する。

### 検討した代替案

**org スコープ Fine-grained PAT**: 単一 org にスコープした PAT を各クライアント用に発行すれば、App なしで隔離可能。しかしユーザー個人に紐づく（退職リスク）、最大1年で失効し手動ローテーション必要、クライアントが増えるたびに PAT を個別管理する運用負荷がある。GitHub App なら org 側が管理主体になり、トークンは自動ローテーション（1h）。スケーラビリティと運用の観点から GitHub App を選択。

**ログイン用と収集用で App を分離**: 関心の分離としては綺麗だが、2つの App を管理する運用コストに見合わない。OAuth フローと Installation Token は同一 App で共存でき、権限は競合しない。1つの App でシンプルに運用する。

## 既存 GitHub App の現状

| 項目        | 値                                             |
| ----------- | ---------------------------------------------- |
| App 名      | upflow-team                                    |
| App ID      | 2966188                                        |
| Client ID   | Iv23liGhBvHENrWfFGOy                           |
| Owner       | **techtalkjp** org（@coji から Transfer 済み） |
| 用途        | ログイン認証（OAuth）のみ                      |
| 現在の権限  | Account: Email addresses (read-only)           |
| Private key | 未生成                                         |
| Setup URL   | 未設定                                         |
| Webhook     | Active（Secret 未設定）                        |

## 移行後の GitHub App 構成

| 項目           | 変更                                                    |
| -------------- | ------------------------------------------------------- |
| Owner          | techtalkjp org（Transfer 済み ✅）                      |
| 用途           | ログイン認証 **+ データ収集**                           |
| 追加権限       | Repository: contents, pull_requests, deployments (read) |
| Private key    | 新規生成                                                |
| Setup URL      | `https://upflow.team/api/github/setup`                  |
| Webhook Secret | 新規設定                                                |

> **Transfer 時の注意**: GitHub App の Transfer ownership で org に移すと **Client ID は変わらない**。既存のログインユーザーへの影響なし。Client Secret は再生成が必要な場合がある（要確認）。

## GitHub App 方式の概要

```text
既存 App「upflow-team」を techtalkjp org に Transfer + 権限追加
    ↓
クライアントが自分の org に App をインストール
    ↓
Setup callback + 署名付き state で Installation ID を安全に取得・保存
    ↓
Installation Access Token を都度発行（有効期限 1h、@octokit/auth-app が自動リフレッシュ）
    ↓
このトークンはインストール先 org のリポにしかアクセスできない ← 本質的な隔離
```

1つの App で2つの認証フローを使い分ける:

- **OAuth フロー** → ユーザーログイン（better-auth の socialProviders.github、既存動作）
- **Installation Token** → データ収集（crawler, backfill 等の API アクセス）

## GitHub App に必要な権限

| スコープ                  | 権限 | 用途                                   | 状態     |
| ------------------------- | ---- | -------------------------------------- | -------- |
| Account: Email addresses  | read | ログイン時のメール取得                 | **既存** |
| Repository: contents      | read | コミット、ファイル取得                 | **追加** |
| Repository: pull_requests | read | PR、レビュー、コメント取得             | **追加** |
| Repository: metadata      | read | リポジトリ一覧（暗黙的に付与）         | **追加** |
| Repository: deployments   | read | DeployedEvent タイムラインアイテム取得 | **追加** |

> PoC（2026-03-23）で全クエリの動作確認済み。`deployments:read` により `DeployedEvent` も正常取得。

## 影響範囲（GitHub トークンを使う全箇所）

計画の対象は crawler と repositories.add だけではない。`privateToken` を使う **全 call site** を共通のトークンプロバイダーに統一する。

| 箇所                | ファイル                                                                                    | 用途                |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| crawl ジョブ        | `app/services/jobs/crawl.server.ts`                                                         | PR データ収集       |
| backfill ジョブ     | `app/services/jobs/backfill.server.ts`                                                      | PR メタデータ再取得 |
| リポジトリ追加      | `app/routes/$orgSlug/settings/repositories.add/`                                            | owner/repo 一覧表示 |
| PR compare/refresh  | `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`                     | 個別 PR 再取得      |
| GitHub ユーザー検索 | `app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts` | ユーザー名検索      |

## 実装計画

### Phase 0: 即時リスク軽減 + App 移転（先行実施）

**A. リポジトリ追加・削除を owner ロールに限定する**

- PAT 期間中に admin が他 org のリポを追加できないようにする
- owner ロールチェック関数を新規作成（既存の `requireOrgMember` + `isOrgAdmin` を参考に `role === 'owner'` チェック）
- 適用対象ルート:
  - `app/routes/$orgSlug/settings/repositories.add/index.tsx`（追加）
  - `app/routes/$orgSlug/settings/repositories/$repository/settings/index.tsx`（削除 action）
- GitHub App 移行完了後は admin に開放可能
- **工数**: 小（権限チェック関数1つ + 2箇所の適用）

**B. GitHub App を techtalkjp org に Transfer** ✅ 完了（2026-03-23）

- 「upflow-team」（本番）と「upflow-dev」（開発）の両方を techtalkjp org に Transfer 済み
- Client Secret はそのまま有効、環境変数の更新不要
- ログイン動作確認済み

### Phase 1: PoC（技術検証） ✅ 完了（2026-03-23）

テスト用 GitHub App（upflow-poc-test、App ID: 3164807）を作成し、techtalkjp org にインストールして検証。

**検証結果**:

| 検証項目                                       | 結果                                                         |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `@octokit/auth-app` で Installation Token 取得 | ✅ 動作確認                                                  |
| `GET /installation/repositories` でリポ一覧    | ✅ 27リポ取得、owner 抽出も可能                              |
| GraphQL: PR 一覧取得                           | ✅                                                           |
| GraphQL: タイムライン（DeployedEvent 含む）    | ✅ `deployments:read` で動作                                 |
| GraphQL: コミット一覧                          | ✅                                                           |
| GraphQL: レビュー一覧                          | ✅                                                           |
| REST: pulls.listFiles                          | ✅                                                           |
| GraphQL: タグ一覧                              | ✅                                                           |
| `GET /user/repos`（現行リポ追加画面）          | ❌ 403 — Installation Token では使用不可                     |
| Search API のスコープ                          | ⚠️ **スコープされない**（facebook/react 等の公開リポも返る） |

**重要な発見**:

1. **`GET /user/repos` は Installation Token で 403** → `GET /installation/repositories` への切り替えが必須（計画通り）
2. **Search API は Installation Token でもスコープされない**（GitHub の既知の制限）→ `GET /installation/repositories` で全件取得 + アプリ側フィルタに変更。Renovate 等の主要 GitHub App も同じ手法を採用。クライアント org のリポ数は数十〜数百なので実用上問題なし（既存の5分キャッシュも活用可能）
3. **全 GraphQL クエリが Installation Token でそのまま動作** → `createFetcher` の Octokit 差し替えだけで crawler は移行可能

PoC スクリプト: `scripts/poc-github-app.ts`, `scripts/poc-repo-add-api.ts`

### Phase 2: GitHub App 基盤整備

> **詳細実装計画**: `docs/github-app-phase2-plan.md` を参照。以下は概要のみ。

**アーキテクチャ**:

- **データ分割**: 接続先情報（installation_id, github_org 等）は shared DB の `github_app_links`、認証設定（method, privateToken, app_suspended_at）は shared DB の `integrations`（`organization_id` で org に紐づく）で管理。`integrations` と `github_app_links` は同一 DB なので 1 クエリで JOIN 可能。tenant DB 全走査は不要
- **接続経路**: Setup URL callback + 署名付き state パラメータが主経路。セッション不要で安全にテナント特定。Webhook は状態更新（deleted, suspend, repo selection 変更）に使用
- **method の意味**: `method` は常に実効の認証方式を表す。GitHub App link が完了した時点で自動的に `token` → `github_app` に切り替わる。リンク前は PAT のまま（crawl が止まらない）

**PR 構成（4分割）**:

1. スキーマ拡張 + 依存関係（`integrations` の shared DB 移行、`github_app_links`、`app_suspended_at`）
2. Octokit factory + fetcher リファクタ + 全 call site 更新
3. Webhook + Setup callback + Installation 紐付け + state トークン
4. 設定 UI + リポ追加画面の App UX

**接続フロー（org 名の手入力不要）**:

1. ユーザーが「GitHub App をインストール」ボタン or「インストール URL をコピー」
2. サーバーが署名付き state（organizationId + expiry）を生成
3. GitHub でインストール → setup callback に state 付きリダイレクト
4. state 検証 → GitHub API で installation 検証 → link 保存 + method 自動切替

### Phase 3: 未対応の詳細（Phase 2 完了後）

- `installation_repositories` イベントでの個別リポのアクセス状態フラグ更新・警告 UI
- `repositories` テーブルへの `is_accessible` カラム追加
- 定期 reconciliation バッチ（`GET /app/installations` と `github_app_links` の突合）

### Phase 4: クライアント移行

各クライアント独立に進行可能:

```text
1. Settings → Integration で「インストール URL をコピー」
   → 署名付き state 入りの URL がコピーされる
2. クライアントに URL を共有（Slack 等）
   → 「全リポジトリ」推奨だが、選択リポでも可（制限あり表示）
3. クライアントが GitHub で Install
   → setup callback で自動リンク + method 自動切替
   → PAT は保持されたまま（ロールバック用）
4. 動作確認（crawler 1サイクル完了、リポ一覧表示、リポ追加）
5. 検証期間（最低1週間）
6. 問題なければ設定画面から PAT を明示的に削除
7. リポ追加/削除権限を admin に開放
```

**ロールバック手順**: Settings で「接続解除」→ method が自動で `token` に復帰。PAT が残っていれば即座に復旧。PAT 削除済みの場合は PAT を再発行して設定。

### Phase 5: クリーンアップ（全クライアント移行完了後）

- PAT 方式のコードパスを整理（新規 org セットアップでも GitHub App を使うなら削除可）
- `requireOrgOwner` のリポ操作制限を解除し admin に開放
- 個人 PAT を GitHub から revoke
- integrations データ移行スクリプトの削除（`db/migrate-integrations-to-shared.ts`, `start.sh` の呼び出し, `package.json` のスクリプト）

## 設計上の判断

### やること

- 既存 GitHub App「upflow-team」を techtalkjp org に移転し、ログイン + データ収集を1つの App で統一
- `@octokit/auth-app` の `authStrategy` による Octokit 認証の委譲（自前実装しない）
- 移行期間中のリポ追加 owner 限定（既存ロールで対応）
- PoC による技術検証を先行
- Setup callback + 署名付き state による installation 管理（webhook は状態更新のみ）
- `github_app_links`（shared DB）で installation → tenant の O(1) ルックアップ

### やらないこと（YAGNI）

- 汎用 RBAC / 細かい権限設定 UI
  - 理由: 2クライアントの段階では実際のユースケースが不足。想像で権限マトリクスを作るとオーバーエンジニアリングになる
  - 将来: ユーザーが増えて権限の細分化ニーズが出た時に、実際のユースケースに基づいて設計する
- ログイン用と収集用で App を分離
  - 理由: OAuth フローと Installation Token は同一 App で共存可能。2つの App を管理する運用コストに見合わない
- GitHub App Manifest フロー（各クライアントが自分の App を作る方式）
  - 理由: 2クライアントでは過剰。単一 App で十分
- 1テナント複数 org 対応（`integrations` を複数行対応にする）
  - 前提: 1テナント = 1 GitHub org。現在の2クライアントとも1 org ずつ
  - `integrations` テーブルは1行のみの前提で設計する（`executeTakeFirst()` のまま）
  - 将来: 複数 org が必要になったら `integrations` を複数行対応に拡張

## 技術メモ

### 環境変数

| 変数名                   | 用途                | 備考                                                                                                |
| ------------------------ | ------------------- | --------------------------------------------------------------------------------------------------- |
| `GITHUB_CLIENT_ID`       | OAuth Client ID     | **既存**（Iv23liGhBvHENrWfFGOy）、Transfer 後も変わらない                                           |
| `GITHUB_CLIENT_SECRET`   | OAuth Client Secret | **既存**、Transfer 後に再生成が必要な場合がある                                                     |
| `GITHUB_APP_ID`          | App ID              | **既存**（2966188）、Installation Token 生成に使用                                                  |
| `GITHUB_APP_PRIVATE_KEY` | PEM 秘密鍵          | **新規生成**。複数行文字列。Fly.io secrets では base64 エンコードして保存し、アプリ側でデコードする |
| `GITHUB_WEBHOOK_SECRET`  | Webhook 署名検証用  | **新規設定**。`X-Hub-Signature-256` の検証に使用                                                    |

### セキュリティ

- Installation Access Token は 1h で自動失効（PAT より安全）
- `@octokit/auth-app` の `authStrategy` が Octokit のリクエストごとに透過的にリフレッシュ
- App 秘密鍵が漏洩した場合: GitHub App 設定画面で鍵をローテーション → 環境変数を更新 → 再デプロイ
- Webhook ペイロードは必ず署名検証する（`X-Hub-Signature-256`）
- `setup_url` の `installation_id` は単独で信用しない（spoof 可能、GitHub 公式で警告あり）。署名付き state でテナント特定 + GitHub API で installation を検証する二重チェック

### 注意点

- GitHub App はリポ単位でもインストール可能（クライアントが全リポ公開したくない場合に有用）。ただし Upflow に登録済みのリポが選択から外れると crawl が 404 になるため、`installation_repositories` webhook で検知し UI で警告を出す
- GitHub App の per-installation レート制限は 5000 req/h（REST）, 5000 points/h（GraphQL）。大規模 org では注意
- 進行中の durably crawl ジョブは古いトークンで動いている可能性がある。method 切り替えは crawl が走っていないタイミングで行う
- integration 更新時・webhook 受信時に `clearOrgCache` を呼び、旧トークンベースのキャッシュを無効化する
