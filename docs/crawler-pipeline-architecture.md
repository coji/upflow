# Crawler & Pipeline Architecture

クローラー・変換パイプラインの将来設計メモ。
すぐに着手するわけではないが、100〜2000 テナント規模を想定した設計方針を記録しておく。

## 現状の構造

```
job-scheduler (cron 毎時30分, シングルプロセス)
  └─ crawlJob()
       └─ for each organization (直列)
            ├─ for each repository (直列)
            │    └─ provider.fetch()  ← API取得 + ローデータ保存
            └─ analyzeAndUpsert()
                 ├─ provider.analyze()  ← 全リポジトリ分を一括変換
                 ├─ upsert × N         ← 1件ずつ直列 INSERT
                 ├─ classifyPullRequests()
                 └─ exportToSpreadsheet()
```

### 現状の問題点

- **全テナント直列**: テナント A の完了を待ってからテナント B が始まる
- **fetch と transform が混在**: fetch 内で reviewers.requestedAt 補完など加工をしている
- **リトライが場当たり的**: 504、空レスポンス対策を個別に追加している
- **チェックポイントなし**: 途中で落ちたら最初からやり直し
- **isRunning がプロセスメモリ**: 複数 Worker で排他制御できない

## 目標アーキテクチャ

### データレイヤー (dbt 的パイプライン)

```
[Source]  fetch が書く。GitHub API レスポンスに近い形。冪等な upsert。
  github_raw_pull_requests    (repository_id, number, data, fetched_at)
  github_raw_commits          (repository_id, pr_number, data, fetched_at)
  github_raw_reviews          (repository_id, pr_number, data, fetched_at)
  github_raw_comments         (repository_id, pr_number, data, fetched_at)
  github_raw_timeline_items   (repository_id, pr_number, data, fetched_at)
  github_raw_files            (repository_id, pr_number, data, fetched_at)
  github_raw_tags             (repository_id, data, fetched_at)  ← 既存

[Staging]  JSON をフラットに展開 (VIEW or generated columns)
  stg_commits        (repository_id, pr_number, sha, author, date)
  stg_reviews        (repository_id, pr_number, reviewer, state, submitted_at)
  stg_timeline_events(repository_id, pr_number, type, actor, created_at)
  stg_files          (repository_id, pr_number, path, additions, deletions)

[Intermediate]  ビジネスロジック単位の中間テーブル
  int_first_commit_dates       (pr → first_committed_at)
  int_first_review_dates       (pr → first_reviewed_at)
  int_review_request_dates     (pr × reviewer → requested_at)
  int_release_dates            (pr → released_at)
  int_cycle_times              (pr → coding/pickup/review/deploy_time)
  int_review_responses         (pr × commenter → response_time)

[Mart]  ダッシュボード向け最終形
  mart_pull_requests           (現 pull_requests 相当)
  mart_review_activity         (現 pull_request_reviews 相当)
  mart_reviewer_assignments    (現 pull_request_reviewers 相当)
  mart_review_responses        (現在は永続化されていない)
```

**原則**:

- Source 層は API レスポンスの忠実な保存。ビジネスロジックは一切入れない
- Staging 以降は Source からいつでも再構築可能
- 各 Intermediate は独立してテスト・再計算できる
- ロジック変更時は transform だけ再実行すればよい

### ジョブアーキテクチャ (分散処理)

```
[Scheduler]
  │  cron or webhook トリガー
  │  テナント × リポジトリ単位でジョブをエンキュー
  │
[Job Queue]  BullMQ / CloudTasks / SQS 等
  │
  ├─ FetchJob(tenant_id, repository_id)
  │    冪等。1リポジトリの API 取得 + ローデータ保存
  │    完了 → TransformJob をエンキュー
  │
  ├─ TransformJob(tenant_id, repository_id?)
  │    冪等。ローデータ → Staging → Intermediate → Mart
  │    リポジトリ単位 or テナント全体
  │
  ├─ ClassifyJob(tenant_id)
  │    LLM Rate limit が別なので独立ジョブ
  │
  └─ ExportJob(tenant_id)
       スプレッドシート等への外部書き出し
```

**独立性**:

- テナント同士 → 完全独立 (DB も別)
- リポジトリ同士 → テナント内で独立 (fetch は並列可能)
- PR 同士 → リポジトリ内でほぼ独立 (release 計算のみ横断)

### クローラーのベストプラクティス

**Rate limit 管理**:

- GraphQL: `x-ratelimit-remaining` ヘッダを監視、残り少なければスロットル
- REST (files 等): per_page=100 でページネーション、conditional request (ETag/304) で節約

**チェックポイント**:

```sql
-- 新規テーブル
CREATE TABLE github_sync_state (
  repository_id TEXT NOT NULL PRIMARY KEY,
  last_cursor TEXT,                    -- GraphQL ページネーションカーソル
  last_updated_at TEXT,                -- 最後に確認した PR の updatedAt
  last_synced_at DATETIME,             -- sync 完了時刻
  sync_status TEXT DEFAULT 'idle',     -- idle | running | failed
  error_message TEXT,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);
```

**インクリメンタル取得**:

- `updatedAt` 降順でページネーション
- 前回の `last_updated_at` 以前の PR が出たら停止
- 現状の「全件取って比較」より API コスト低い

**リトライ**:

- Exponential backoff with jitter
- ジョブ単位でリトライ (PR 単位ではなくリポジトリ単位)
- 冪等な upsert なので同じジョブを複数回実行しても安全

### Turso (libSQL) 移行との関係

Database-per-tenant + Turso にすると:

- **ファイルロック制約の解消**: Worker がどこからでも書き込める
- **Embedded Replicas**: 読み取りはローカルレプリカ (dashboard は高速)、書き込みはリモート Primary
- **テナント間の完全分離**: DB が物理的に別なので干渉ゼロ
- **Worker のスケールアウト**: 複数 Worker が異なるテナントを並列処理できる

Turso 移行は Phase 3 (ジョブキュー導入) の前提になる。
SQLite ファイルベースのままだと Worker 分散ができないため。

## 移行フェーズ

### Phase 1: ローデータテーブル分割 + fetch 純化

- `github_raw_data` (1行 fat JSON) → リソース種別ごとのテーブルに分割
- fetch から加工ロジック (requestedAt 補完等) を追い出す
- fetch は「API → ローデータ保存」だけに徹する
- **効果**: transform の再実行が安全にできる土台

### Phase 2: ジョブ単位の分割

- crawlJob のループを (tenant_id, repository_id) 単位のジョブに分解
- テナント内リポジトリの並列化 (まだ同一プロセス、Promise.all)
- analyzeAndUpsert をリポジトリ単位に分割
- github_sync_state テーブル導入
- **効果**: 並列化の基盤、途中再開が可能に

### Phase 3: Turso 移行 + Worker 分散

- SQLite → Turso (libSQL) に移行
- ジョブキュー (BullMQ 等) 導入
- Worker プロセスを複数起動して分散処理
- DB ベースのジョブ排他制御
- **効果**: テナント数に対してリニアにスケール

### Phase 4: GitHub App 化 + Webhook

- GitHub App 作成、installation 管理
- Webhook receiver (署名検証、キューイング)
- PR サイズ分類のリアルタイムラベル付け
- PAT → GitHub App の段階的移行
- cron の頻度を下げて Webhook メインに
- **効果**: リアルタイム反映、能動的フィードバック、PAT 依存の解消

### Phase 5: transform パイプライン段階化

- buildPullRequests を decompose → 中間テーブル
- Staging 層 (JSON 展開 VIEW)
- 部分再計算 (変更があった intermediate だけ再実行)
- **効果**: ロジック変更時の再計算コスト削減、デバッグ容易性

## スケール見積もり

| テナント数 | リポジトリ概算 | 現状 (直列) | Phase 2 (並列) | Phase 3 (分散) |
| ---------- | -------------- | ----------- | -------------- | -------------- |
| 10         | ~50            | ~30分       | ~10分          | ~5分           |
| 100        | ~500           | ~5時間      | ~1.5時間       | ~15分          |
| 1000       | ~5000          | 実用不可    | 実用不可       | ~1時間         |

※ GitHub API Rate limit (5000 points/hour per token) がボトルネック。
テナントごとに token が異なるため、テナント並列では rate limit は競合しない。
リポジトリ並列は同一 token 内なので rate limit の範囲内で制御が必要。

## GitHub App 化 + Webhook リアルタイム連携

### 背景: ポーリングからイベント駆動へ

現状は cron (毎時 30 分) でポーリングしているため、PR の変化が反映されるまで最大 1 時間かかる。
GitHub App + Webhook にすることで、イベント発生時に即座にデータを更新でき、
さらに **PR に対して能動的なフィードバックを返す** ことが可能になる。

ダッシュボードが「過去を振り返るツール」から「今の行動を変えるツール」に進化する。

### データ取得モデルの変化

```
[現状: ポーリング]
cron (30分) → 全 PR 一覧取得 → 差分検出 → 詳細取得 → 保存

[目標: イベント駆動 + ポーリング併用]
Webhook イベント → 該当 PR だけ即時更新 → 保存 → リアクション
cron (低頻度)   → 取りこぼし補完 + 全体整合性チェック
```

Webhook だけに依存すると配信失敗時にデータが欠落するため、
cron による定期スキャンは「セーフティネット」として残す（頻度は下げる）。

### 購読する Webhook イベント

| イベント                                                                                       | トリガー              | 用途                               |
| ---------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------- |
| `pull_request` (opened/closed/merged/reopened/synchronize/converted_to_draft/ready_for_review) | PR ライフサイクル全般 | PR メタデータ更新、サイズ分類      |
| `pull_request` (synchronize)                                                                   | コミット push         | サイズ再計算 + ラベル更新          |
| `pull_request_review`                                                                          | レビュー提出          | レビュー活動記録、pickup_time 計算 |
| `pull_request_review_comment`                                                                  | レビューコメント      | レスポンスタイム計算               |
| `issue_comment`                                                                                | PR コメント           | ディスカッション記録               |
| `pull_request` (review_requested)                                                              | レビュー依頼          | レビュアー記録、requestedAt        |

### PR サイズ分類のリアルタイムフィードバック

**コンセプト**: PR が作成 or コミット追加されるたびにサイズを分類し、
GitHub のラベルとして可視化する。大きすぎる PR には早期に気づける。

```
[Webhook: pull_request.opened / pull_request.synchronize]
  ↓
[サイズ計算]
  additions + deletions → XS / S / M / L / XL
  ↓
[ラベル更新]  GitHub API でラベルを付け替え
  size/XS, size/S, size/M, size/L, size/XL
  ↓
[コメント (optional)]
  サイズが L→XL に増えた場合に注意喚起コメント
```

**サイズ分類の閾値** (設定可能にする):

| ラベル  | additions + deletions | 意味                   |
| ------- | --------------------- | ---------------------- |
| size/XS | 1-10                  | 微修正                 |
| size/S  | 11-100                | 小さな変更             |
| size/M  | 101-300               | 中規模                 |
| size/L  | 301-1000              | 大きい、分割検討       |
| size/XL | 1001+                 | 非常に大きい、分割推奨 |

**ポイント**:

- `synchronize` イベント (コミット push) のたびに再計算するので、
  PR が育つにつれてラベルが `size/S` → `size/M` → `size/L` と変わる
- 開発者は PR を開いた瞬間に「今どのサイズか」がわかる
- チームの size/L 以上の PR 割合をダッシュボードで追跡できる
- 閾値はテナント (organization) ごとに設定可能にする

### Webhook 処理のアーキテクチャ

```
[GitHub]
  │  POST /api/github/webhook
  │  X-GitHub-Event, X-Hub-Signature-256
  │
[Webhook Receiver]  (Express middleware)
  │  署名検証 → イベント種別判定 → ジョブエンキュー
  │  ※ 即座に 200 を返す (GitHub は 10s タイムアウト)
  │
[Job Queue]
  │
  ├─ WebhookSyncJob(tenant_id, repository_id, pr_number)
  │    該当 PR のローデータを更新 (fetch 1件分)
  │    → TransformJob をエンキュー
  │
  ├─ SizeLabelJob(tenant_id, repository_id, pr_number)
  │    サイズ計算 → GitHub ラベル更新
  │    synchronize イベントのたびに実行
  │
  └─ TransformJob(tenant_id, repository_id)
       通常の transform パイプライン (既存)
```

**Webhook Receiver の要件**:

- **署名検証**: `X-Hub-Signature-256` で HMAC-SHA256 検証。必須
- **即座にレスポンス**: 処理はキューに投げて 200 を返す
- **冪等**: 同じイベントが複数回来ても安全 (delivery ID で重複排除)
- **installation_id → tenant_id マッピング**: GitHub App の installation を
  テナントに紐づけるテーブルが必要

### GitHub App 化に伴うデータモデル追加

```sql
-- GitHub App installation とテナントの紐付け
CREATE TABLE github_app_installations (
  installation_id INTEGER NOT NULL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  account_login TEXT NOT NULL,       -- GitHub org/user login
  account_type TEXT NOT NULL,        -- 'Organization' | 'User'
  installed_at DATETIME NOT NULL,
  suspended_at DATETIME,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE CASCADE
);

-- Webhook イベントログ (デバッグ + 重複排除)
CREATE TABLE webhook_event_log (
  delivery_id TEXT NOT NULL PRIMARY KEY,
  event_type TEXT NOT NULL,
  action TEXT,
  repository_id TEXT,
  pr_number INTEGER,
  received_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  processed_at DATETIME,
  status TEXT NOT NULL DEFAULT 'pending'  -- pending | processed | failed
);

-- テナントごとのサイズ分類閾値設定
-- organization_settings に追加
ALTER TABLE organization_settings ADD COLUMN size_thresholds TEXT
  DEFAULT '{"xs":10,"s":100,"m":300,"l":1000}';
```

### 認証モデルの変化

```
[現状: Personal Access Token]
  integrations.private_token にユーザーの PAT を保存
  Rate limit: 5000/hour (ユーザー単位)

[目標: GitHub App]
  App の秘密鍵で installation access token を生成
  Rate limit: 5000/hour (installation 単位)
  ※ テナントあたりの rate limit は変わらないが、
    ユーザーの PAT に依存しなくなる (退職リスク解消)
```

**移行時の注意**: PAT → GitHub App は段階的に移行する。
既存テナントの PAT を即座に無効化しない。
GitHub App と PAT の両方をサポートする期間を設ける。

### cron との使い分け

|      | Webhook                      | cron                           |
| ---- | ---------------------------- | ------------------------------ |
| 用途 | リアルタイム更新、ラベル付け | 取りこぼし補完、整合性チェック |
| 頻度 | イベント発生時               | 数時間に 1 回 (頻度下げる)     |
| 対象 | 変更があった PR のみ         | 全 PR スキャン                 |
| 依存 | GitHub の Webhook 配信       | なし (自己完結)                |

Webhook がメイン、cron がバックアップ。
Webhook が数時間止まっても、次の cron で追いつける設計にする。
