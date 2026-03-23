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
Installation ID を取得（webhook で正本反映）
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

> **注意**: `fetcher.ts` の GraphQL で `DeployedEvent` を取得しているため `deployments:read` が必要。PoC で全クエリの動作確認をすること。

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

### Phase 1: PoC（技術検証）

既存 App に権限を追加する前に、テスト環境でクリティカルな仮定を検証する。

1. **テスト用 GitHub App を作成**（個人アカウントでOK、検証後に削除）
   - 必要な権限（contents, pull_requests, deployments: read）を設定
   - Private key を生成
2. **テスト org にインストール**
3. **検証項目**:
   - `@octokit/auth-app` の `createAppAuth` → `installationId` 指定で Octokit を生成し、リクエストごとに自動リフレッシュされるか
   - `GET /installation/repositories` でリポ一覧が取得できるか
   - `fetcher.ts` の全 GraphQL クエリが Installation Token で動作するか（特に `DeployedEvent`, `ReviewRequestedEvent` 等のタイムラインアイテム）
   - **REST Search API** (`GET /search/repositories`) が Installation Token で期待通りスコープされるか。されない場合は `GET /installation/repositories` ベースのフィルタリングに切り替え
   - **アクセス喪失時の挙動**: 選択インストールで対象外のリポに GraphQL を投げた場合のエラー形式
   - **選択インストール時の repo 一覧**: `GET /installation/repositories` が選択されたリポのみ返すか
4. **PoC の結果で権限リストと設計を最終確定**

### Phase 2: GitHub App 基盤整備

1. **既存 App「upflow-team」に権限追加 + 設定更新**
   - PoC で確定した権限を追加
   - Private key を生成
   - Webhook Secret を設定
   - Setup URL: `https://upflow.team/api/github/setup`
   - 「Redirect on update」を有効化（リポ選択変更時に callback）

2. **`@octokit/auth-app` を導入**
   - JWT 生成、Installation Token キャッシュ、自動リフレッシュを全て委譲
   - 自前の JWT 署名やキャッシュロジックは不要

3. **`integrations` テーブル拡張**（tenant DB）

   ```sql
   -- 既存
   provider TEXT NOT NULL DEFAULT 'github'
   method TEXT NOT NULL DEFAULT 'token'
   private_token TEXT

   -- 追加
   app_installation_id INTEGER                    -- GitHub App の Installation ID
   app_installation_target_login TEXT             -- インストール先 org/user の login 名
   app_repository_selection TEXT                  -- 'all' | 'selected'（インストール時の選択）
   app_installation_suspended_at TEXT             -- サスペンド日時（webhook で更新）
   ```

   - `method: 'token'` → PAT 方式（現行）
   - `method: 'github_app'` → GitHub App 方式（新規）
   - **移行期間中は `private_token` を保持する**（ロールバック用）。PAT の削除は Phase 4 の検証完了後に明示的に行う

   **関連する更新**:
   - `db/tenant.sql`: スキーマ定義追加
   - `db/migrations/tenant/`: マイグレーション SQL 生成
   - `app/services/tenant-type.ts`: `pnpm db:generate` で型再生成
   - `db/seed.ts`: seed データに新カラム追加
   - `app/routes/$orgSlug/settings/_index/+schema.ts`: `method: z.enum(['token', 'github_app'])`

4. **Octokit 認証の抽象化**

   `tokenProvider` 関数ではなく、**Octokit インスタンス自体に `@octokit/auth-app` の `authStrategy` を組み込む**。これにより各リクエストで自動的にトークンがリフレッシュされ、長時間 crawl でもトークン失効しない。

   ```typescript
   // GitHub App 方式
   import { createAppAuth } from '@octokit/auth-app'

   const octokit = new Octokit({
     authStrategy: createAppAuth,
     auth: {
       appId: GITHUB_APP_ID,
       privateKey: GITHUB_APP_PRIVATE_KEY,
       installationId: integration.appInstallationId,
     },
   })

   // PAT 方式（現行互換）
   const octokit = new Octokit({ auth: token })
   ```

   - `createFetcher` のインターフェースを `{ token: string }` → `{ octokit: Octokit }` に変更
   - Octokit 生成を呼び出し側に移し、fetcher はもらった octokit を使うだけにする
   - **全 call site**（影響範囲の表を参照）に共通の Octokit 生成関数を適用

5. **リポジトリ追加画面の API 切り替え**
   - `getUniqueOwners()`:
     - PAT: `GET /user/repos?affiliation=...`（現行）
     - App: `GET /installation/repositories` → owner を抽出
   - `getRepositoriesByOwnerAndKeyword()`:
     - PAT: `GET /search/repositories`（現行）
     - App: PoC 結果に基づき Search API or `GET /installation/repositories` + フィルタ
   - loader の前提条件更新: `privateToken` 必須 → `method` に応じて `privateToken` or `appInstallationId` を要求
   - `getIntegration()` クエリを拡張: `method`, `appInstallationId`, 接続状態を返す
   - **重要**: この画面は PAT → App で API エンドポイントが根本的に異なる。単純なトークン差し替えでは済まない

6. **Webhook エンドポイント**
   - ルート: `app/routes/api.github.webhook.ts`
   - `X-Hub-Signature-256` でペイロード署名を検証
   - 購読イベント:
     - `installation`: インストール・アンインストール・サスペンド検知
     - `installation_repositories`: リポの追加・削除検知（選択インストール対応）
   - **installation イベント処理**:
     - `created`: `appInstallationId`, `targetLogin`, `repositorySelection` を tenant DB に保存（**正本**）
     - `deleted`: integration の method を無効化、UI に警告表示
     - `suspend` / `unsuspend`: `appInstallationSuspendedAt` を更新
   - **installation_repositories イベント処理**:
     - org キャッシュを無効化（`clearOrgCache`）
     - 登録済みリポがアクセス不可になった場合: リポの状態フラグを更新、設定画面に警告表示
   - **installation_id の信頼性**: `setup_url` callback の `installation_id` は spoof 可能（GitHub 公式ドキュメントで警告あり）。callback は UX の補助（設定画面への自動遷移）にのみ使い、**installation_id の正本は webhook で反映する**

7. **Setup URL callback ルート**
   - ルート: `app/routes/api.github.setup.ts`
   - 役割: インストール完了後にユーザーを設定画面にリダイレクトするだけ
   - `installation_id` の保存は行わない（webhook が正本）
   - state パラメータで org を特定し、`/:orgSlug/settings/integration` にリダイレクト

8. **キャッシュ戦略**
   - integration の method 変更時に `clearOrgCache` を呼ぶ
   - webhook 受信時にも `clearOrgCache` を呼ぶ
   - これにより旧トークンベースの owner/repo 一覧が残り続ける問題を防ぐ

### Phase 3: 設定画面 UI

1. **Integration 設定画面の拡張**
   - 接続方式の選択: 「GitHub Token（PAT）」 or 「GitHub App」
   - GitHub App 選択時:
     - 「GitHub App をインストール」リンク → GitHub のインストール画面
     - インストール完了 → setup_url callback → 設定画面にリダイレクト
     - webhook で `installation_id` が保存されるまでポーリングまたは画面リロードで反映
   - 接続状態の表示:
     - 未接続
     - インストール済み（`app_installation_target_login` 表示）
     - サスペンド中（要確認）
     - アンインストール済み（要再接続）
   - リポ選択モードの表示: 「全リポジトリ」or「選択されたリポジトリ（GitHub App 設定で変更可）」

2. **リポジトリ追加画面**
   - GitHub App 接続時、インストール先 org のリポのみ表示（API レベルで保証）
   - App がリポ選択インストールされている場合の注意表示: 「一部のリポジトリのみアクセス可能です。GitHub の App 設定から変更できます」
   - 登録済みリポがアクセス不可の場合の警告表示

### Phase 4: クライアント移行

各クライアント独立に進行可能:

```text
1. クライアントに GitHub App インストールを依頼
   - インストール URL を共有（https://github.com/apps/upflow-team/installations/new）
   - 「全リポジトリ」推奨だが、選択リポでも可（制限あり表示）
2. webhook で installation_id が自動保存される
3. 設定画面で method を github_app に切り替え
4. 動作確認（crawler 1サイクル完了、リポ一覧表示、リポ追加）
5. 検証期間（最低1週間）: PAT は integration に残しておく
6. 問題なければ設定画面から PAT を明示的に削除
7. リポ追加/削除権限を admin に開放
```

**ロールバック手順**: GitHub App で問題発生時、設定画面で method を `token` に戻す。PAT が残っていれば即座に復旧。PAT 削除済みの場合は PAT を再発行して設定。

### Phase 5: クリーンアップ（全クライアント移行完了後）

- PAT 方式のコードパスを整理（新規 org セットアップでも GitHub App を使うなら削除可）
- `requireOrgOwner` のリポ操作制限を解除し admin に開放
- 個人 PAT を GitHub から revoke

## 設計上の判断

### やること

- 既存 GitHub App「upflow-team」を techtalkjp org に移転し、ログイン + データ収集を1つの App で統一
- `@octokit/auth-app` の `authStrategy` による Octokit 認証の委譲（自前実装しない）
- 移行期間中のリポ追加 owner 限定（既存ロールで対応）
- PoC による技術検証を先行
- webhook 主導の installation 管理（setup_url callback は補助のみ）

### やらないこと（YAGNI）

- 汎用 RBAC / 細かい権限設定 UI
  - 理由: 2クライアントの段階では実際のユースケースが不足。想像で権限マトリクスを作るとオーバーエンジニアリングになる
  - 将来: ユーザーが増えて権限の細分化ニーズが出た時に、実際のユースケースに基づいて設計する
- ログイン用と収集用で App を分離
  - 理由: OAuth フローと Installation Token は同一 App で共存可能。2つの App を管理する運用コストに見合わない
- GitHub App Manifest フロー（各クライアントが自分の App を作る方式）
  - 理由: 2クライアントでは過剰。単一 App で十分

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
- `setup_url` の `installation_id` は信用しない（spoof 可能、GitHub 公式で警告あり）

### 注意点

- GitHub App はリポ単位でもインストール可能（クライアントが全リポ公開したくない場合に有用）。ただし Upflow に登録済みのリポが選択から外れると crawl が 404 になるため、`installation_repositories` webhook で検知し UI で警告を出す
- GitHub App の per-installation レート制限は 5000 req/h（REST）, 5000 points/h（GraphQL）。大規模 org では注意
- 進行中の durably crawl ジョブは古いトークンで動いている可能性がある。method 切り替えは crawl が走っていないタイミングで行う
- integration 更新時・webhook 受信時に `clearOrgCache` を呼び、旧トークンベースのキャッシュを無効化する
