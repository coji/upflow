# バッチ中間データ: JSON ファイル → DB 移行設計

## 背景

現在、バッチ処理の中間データ (GitHub API から取得した PR, commits, reviews, discussions) を JSON ファイルとして `data/json/` に保存している。

```
data/json/{orgId}/{repoId}/
  pullrequests.json
  tags.json
  commits/{prNumber}-commits.json
  reviews/{prNumber}-reviews.json
  discussions/{prNumber}-discussions.json
  release-commits/{sha[0:2]}/{sha}.json
```

- 合計: ~93MB / ~21,000 ファイル
- Fly.io volume に DB ファイルと同居

### 問題

- Turso 移行時に volume を撤廃したいが、JSON ファイルが残る
- ファイル数が多く、バックアップやリストアが面倒
- ファイルシステム依存のコードが複雑 (path-builder, store.ts のキャッシュ機構)

### JSON ファイルの役割

バッチが途中で落ちた場合のチェックポイント:

1. **fetch**: GitHub API → PR 単位で JSON に保存 → 途中で落ちても保存済み分は残る
2. **analyze/upsert**: JSON から読み出し → 分析 → DB 書き込み → 途中で落ちても JSON は残る

この冪等性を維持する必要がある。

## 設計

### テーブル設計

tenant DB に `github_raw_data` テーブルを追加:

```sql
CREATE TABLE github_raw_data (
  repository_id TEXT NOT NULL,
  pull_request_number INTEGER NOT NULL,
  pull_request JSON NOT NULL,    -- ShapedGitHubPullRequest
  commits JSON NOT NULL,         -- ShapedGitHubCommit[]
  reviews JSON NOT NULL,         -- ShapedGitHubReview[]
  discussions JSON NOT NULL,     -- ShapedGitHubReviewComment[]
  fetched_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (repository_id, pull_request_number),
  CONSTRAINT github_raw_data_repository_id_fkey
    FOREIGN KEY (repository_id) REFERENCES repositories (id)
    ON UPDATE CASCADE ON DELETE CASCADE
);
```

リポジトリレベルのデータ用に `github_raw_tags` テーブル:

```sql
CREATE TABLE github_raw_tags (
  repository_id TEXT NOT NULL,
  tags JSON NOT NULL,            -- ShapedGitHubTag[]
  fetched_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (repository_id),
  CONSTRAINT github_raw_tags_repository_id_fkey
    FOREIGN KEY (repository_id) REFERENCES repositories (id)
    ON UPDATE CASCADE ON DELETE CASCADE
);
```

### `pullrequests.json` の扱い

現在 `pullrequests.json` は全 PR のリストで、2 つの目的がある:

1. **増分 fetch の基準**: `lastFetchedAt` = 最新の `updated_at` を取得
2. **analyze 時の PR リスト**: 全 PR をイテレートする入力

DB 移行後:

- `lastFetchedAt` → `SELECT MAX(json_extract(pull_request, '$.updated_at')) FROM github_raw_data WHERE repository_id = ?`
- PR リスト → `SELECT pull_request FROM github_raw_data WHERE repository_id = ?`

`pullrequests.json` は不要になる。

### データフロー (変更後)

```
GitHub API
  ↓
[fetch] PR 単位で github_raw_data に UPSERT
  │     (commits, reviews, discussions をまとめて 1 行)
  │     tags は github_raw_tags に UPSERT
  ↓
github_raw_data テーブル  ← チェックポイント (途中で落ちても保存済み)
  ↓
[analyze] github_raw_data から SELECT → 分析 → cycle time 計算
  ↓
pull_requests, pull_request_reviews 等に UPSERT
```

### 増分 fetch ロジック

```
1. SELECT MAX(json_extract(pull_request, '$.updated_at'))
   FROM github_raw_data WHERE repository_id = ?
   → lastFetchedAt

2. GitHub API から PR リスト取得

3. 各 PR について:
   - updated_at > lastFetchedAt なら:
     - commits, reviews, discussions を fetch
     - github_raw_data に UPSERT
   - そうでなければ skip

4. (refresh モード時は全 PR を fetch して UPSERT)
```

### store.ts の変更

`createStore` のインターフェースを維持しつつ、内部を DB に切り替え:

```typescript
// Before: ファイル I/O
const save = async (filename: string, content: unknown) => {
  await fs.writeFile(pathBuilder.jsonPath(filename), JSON.stringify(content))
}

// After: DB UPSERT
const savePrData = async (prNumber: number, data: {
  pullRequest: ShapedGitHubPullRequest
  commits: ShapedGitHubCommit[]
  reviews: ShapedGitHubReview[]
  discussions: ShapedGitHubReviewComment[]
}) => {
  await tenantDb.insertInto('githubRawData').values({
    repositoryId: repositoryId,
    pullRequestNumber: prNumber,
    pullRequest: JSON.stringify(data.pullRequest),
    commits: JSON.stringify(data.commits),
    reviews: JSON.stringify(data.reviews),
    discussions: JSON.stringify(data.discussions),
  }).onConflict((oc) =>
    oc.columns(['repositoryId', 'pullRequestNumber']).doUpdateSet({...})
  ).execute()
}
```

### PullRequestLoaders の変更

`PullRequestLoaders` インターフェースは維持。実装を DB 読み出しに変更:

```typescript
// Before: ファイルから読み込み
const commits = (number: number) =>
  load<ShapedGitHubCommit[]>(pathBuilder.commitsJsonFilename(number))

// After: DB から読み込み (JSON parse)
const commits = async (number: number) => {
  const row = await tenantDb
    .selectFrom('githubRawData')
    .select('commits')
    .where('repositoryId', '=', repositoryId)
    .where('pullRequestNumber', '=', number)
    .executeTakeFirst()
  return row ? JSON.parse(row.commits) : []
}
```

ただし、analyze 時は全 PR をイテレートするため、N+1 にならないよう一括読み出しも検討:

```typescript
// リポジトリの全 raw data を一括ロード
const allRawData = await tenantDb
  .selectFrom('githubRawData')
  .selectAll()
  .where('repositoryId', '=', repositoryId)
  .execute()

// Map に展開して O(1) アクセス
const rawDataMap = new Map(allRawData.map((r) => [r.pullRequestNumber, r]))
```

## 変更ファイル一覧

| アクション | ファイル                                  | 内容                                                |
| ---------- | ----------------------------------------- | --------------------------------------------------- |
| 追加       | `db/schema-tenant.sql`                    | github_raw_data, github_raw_tags テーブル追加       |
| 追加       | `db/migrations/tenant/XXXXXX.sql`         | マイグレーション                                    |
| 変更       | `app/services/type.ts`                    | kysely-codegen で再生成                             |
| 変更       | `batch/provider/github/store.ts`          | ファイル I/O → DB I/O に変更                        |
| 変更       | `batch/provider/github/provider.ts`       | fetch/analyze を DB ベースに変更                    |
| 変更       | `batch/provider/github/aggregator.ts`     | lastFetchedAt を DB クエリに変更                    |
| 削除       | `batch/helper/path-builder.ts`            | 不要 (テスト含む)                                   |
| 変更       | `batch/provider/github/release-detect.ts` | release-commits ファイル → DB に変更                |
| 変更       | `batch/provider/github/pullrequest.ts`    | loaders の使い方は変わらない (インターフェース維持) |
| 追加       | `db/migrate-json-to-db.ts`                | 既存 JSON → DB 移行スクリプト                       |
| 変更       | `batch/provider/index.ts`                 | Provider interface に tenantDb 依存追加             |

## 移行戦略

### Phase 1: テーブル追加 + 移行スクリプト

1. schema に `github_raw_data`, `github_raw_tags` 追加
2. migration 生成
3. 既存 JSON データを DB に INSERT する移行スクリプト作成
4. 移行実行

### Phase 2: fetch を DB 書き込みに変更

1. `store.ts` の save を DB UPSERT に変更
2. `provider.ts` の fetch ロジックを調整
3. `aggregator.ts` の lastFetchedAt を DB クエリに変更
4. テスト

### Phase 3: analyze を DB 読み出しに変更

1. `store.ts` の loader を DB SELECT に変更
2. `release-detect.ts` を DB ベースに変更
3. テスト

### Phase 4: JSON 関連コード削除

1. `path-builder.ts` 削除
2. `store.ts` からファイル I/O コード削除
3. JSON ファイル削除 (確認後)

## 検討事項

### release-commits の扱い

現在 `release-commits/{sha[0:2]}/{sha}.json` で保存している。これはタグベースの release detection で使われ、特定の SHA のコミット情報をキャッシュしている。

選択肢:

- **A**: `github_raw_release_commits` テーブルを追加
- **B**: release detection 時に毎回 API を叩く (頻度が低ければ許容)
- **C**: `github_raw_tags` に release commit 情報も含める

→ 実装時に実際のデータ量と API コール頻度を見て判断

### fetch 時の書き込み粒度

現在は PR のサブデータ (commits, reviews, discussions) を個別ファイルに保存。DB では 1 行にまとめるため、fetch 途中で落ちた場合の粒度が変わる:

- Before: commits 保存 → reviews 保存 → discussions 保存 (各ステップがチェックポイント)
- After: commits + reviews + discussions を全部取得 → 1 行 UPSERT

PR 1 件分のサブデータ fetch が途中で落ちた場合、DB 方式だと PR 丸ごとやり直しになる。ただし 1 PR のサブデータ取得は数秒なので実害はない。

### メモリ効率

全 raw data を一括ロードすると、リポジトリあたり数 MB がメモリに乗る。現状 (ファイル I/O + メモリキャッシュ) と大差ないため問題なし。
