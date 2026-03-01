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

### Phase 4: transform パイプライン段階化

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
