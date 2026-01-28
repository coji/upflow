# GitHub GraphQL API 移行検討

## 概要

現在の REST API 使用状況を分析し、GraphQL 移行による最適化の可能性を検討する。

---

## 現状分析

### 使用中の REST API エンドポイント

| エンドポイント               | 用途                     | ファイル           |
| ---------------------------- | ------------------------ | ------------------ |
| `pulls.list()`               | 全 PR 取得               | fetcher.ts:46-52   |
| `pulls.listCommits()`        | PR 毎のコミット取得      | fetcher.ts:65-71   |
| `issues.listComments()`      | Issue コメント取得       | fetcher.ts:87-93   |
| `pulls.listReviewComments()` | レビューコメント取得     | fetcher.ts:108-114 |
| `pulls.listReviews()`        | レビュー取得             | fetcher.ts:142-148 |
| `repos.listTags()`           | タグ一覧取得             | fetcher.ts:172-177 |
| `repos.getCommit()`          | タグ毎のコミット詳細取得 | fetcher.ts:189-193 |

**合計: 7 エンドポイント**

---

### データ使用効率（REST API の無駄）

| データ種別   | 取得フィールド数 | 使用フィールド数 | 無駄    |
| ------------ | ---------------- | ---------------- | ------- |
| Pull Request | ~80              | 17               | **79%** |
| Commit       | ~30              | 4                | **87%** |
| Review       | ~20              | 5                | **75%** |
| Comment      | ~25              | 4                | **84%** |
| Tag + Commit | ~45              | 3                | **93%** |

**平均して 80-90% のレスポンスデータが破棄されている**

---

### 現在の非効率性

#### 1. N+1 問題（最大の問題）

**タグ取得時:**

```
repos.listTags() → N 件のタグ
  ↓
各タグに対して repos.getCommit() を呼び出し → N 回の追加 API コール

例: 100 タグ → 101 API コール
```

**該当箇所:** `fetcher.ts:188-195`

```typescript
for (const tag of allTags) {
  const commit = await octokitClient.rest.repos.getCommit({
    owner,
    repo,
    ref: tag.commit.sha,
  })
  // ...
}
```

#### 2. リリース検出時の重複取得

ブランチベースのリリース検出（`release-detect.ts`）で、分析フェーズ中にコミットを再度取得している。

#### 3. ページネーションの往復

REST API は 1 リクエストで最大 100 件。大規模リポジトリでは複数回のリクエストが必要。

---

## GraphQL 移行による改善予測

### API コール数の削減

| シナリオ                   | REST API       | GraphQL      | 削減率  |
| -------------------------- | -------------- | ------------ | ------- |
| 100 タグ取得               | 101 コール     | 1 コール     | **99%** |
| 100 PR + 関連データ        | ~500 コール    | ~5-10 コール | **95%** |
| 全体（典型的なリポジトリ） | 150-200 コール | 5-10 コール  | **95%** |

### 帯域幅の削減

- **80-85% の帯域幅削減**: 必要なフィールドのみ取得
- ネットワーク遅延の大幅減少

### 処理速度の改善

- **10-20 倍の高速化**: ネストされたクエリによる並列データ取得
- N+1 問題の完全解消

---

## GraphQL クエリ設計案

### 1. PR 一覧 + 関連データ一括取得

```graphql
query GetPullRequests($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequests(first: 100, after: $cursor, states: [OPEN, CLOSED, MERGED]) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        number
        state
        title
        url
        author {
          login
        }
        assignees(first: 10) {
          nodes {
            login
          }
        }
        reviewRequests(first: 10) {
          nodes {
            requestedReviewer {
              ... on User {
                login
              }
            }
          }
        }
        isDraft
        headRefName
        baseRefName
        createdAt
        updatedAt
        mergedAt
        mergeCommit {
          oid
        }

        # コミット（最初の1件で十分な場合が多い）
        commits(first: 1) {
          nodes {
            commit {
              oid
              url
              committer {
                user {
                  login
                }
                date
              }
            }
          }
        }

        # レビュー
        reviews(first: 100) {
          nodes {
            id
            author {
              login
            }
            state
            url
            submittedAt
          }
        }

        # コメント
        comments(first: 100) {
          nodes {
            id
            author {
              login
            }
            url
            createdAt
          }
        }

        # レビューコメント
        reviewThreads(first: 100) {
          nodes {
            comments(first: 10) {
              nodes {
                id
                author {
                  login
                }
                url
                createdAt
              }
            }
          }
        }
      }
    }
  }
}
```

**利点:**

- 1 クエリで PR + コミット + レビュー + コメントを取得
- REST では 4 エンドポイント × N PR 回のコール → 1 回に統合

### 2. タグ一覧 + コミット日時一括取得

```graphql
query GetTags($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    refs(refPrefix: "refs/tags/", first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
        target {
          oid
          ... on Commit {
            committedDate
          }
          ... on Tag {
            target {
              ... on Commit {
                oid
                committedDate
              }
            }
          }
        }
      }
    }
  }
}
```

**利点:**

- N+1 問題を完全解消
- 100 タグ + 100 コミット取得: 101 コール → 1 コール

### 3. リリース検出用コミット取得

```graphql
query GetPRCommits($owner: String!, $repo: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $prNumber) {
      commits(first: 250) {
        nodes {
          commit {
            oid
          }
        }
      }
    }
  }
}
```

---

## 実装計画

### Phase 1: タグ取得の GraphQL 化（最優先）

**理由:** N+1 問題の解消で最大の効果

**変更ファイル:**

- `batch/provider/github/fetcher.ts` - `tags()` メソッドを GraphQL に置換

**工数:** 小（1-2 時間）

**効果:** タグ取得の API コールを 99% 削減

### Phase 2: PR 関連データの一括取得

**変更ファイル:**

- `batch/provider/github/fetcher.ts` - 全メソッドを GraphQL に置換
- `batch/provider/github/shaper.ts` - GraphQL レスポンス形式に対応

**工数:** 中（4-8 時間）

**効果:** 全体の API コールを 95% 削減

### Phase 3: リリース検出の最適化

**変更ファイル:**

- `batch/provider/github/release-detect.ts` - GraphQL で必要なデータのみ取得

**工数:** 小（1-2 時間）

**効果:** リリース検出時の重複取得を解消

---

## 技術的考慮事項

### GraphQL クライアント選択

| オプション         | 特徴                       |
| ------------------ | -------------------------- |
| `@octokit/graphql` | Octokit 統合、認証共有可能 |
| `graphql-request`  | 軽量、シンプル             |
| `apollo-client`    | 高機能だがオーバースペック |

**推奨:** `@octokit/graphql`（既存の Octokit と統合しやすい）

### レート制限

- REST: 5,000 リクエスト/時間
- GraphQL: 5,000 ポイント/時間（クエリの複雑さでポイント消費）

GraphQL は複雑なクエリで多くのポイントを消費する可能性があるが、リクエスト数が大幅に減るため、通常は REST より有利。

### 後方互換性

- `shaper.ts` の型定義（`ShapedGitHub*`）は維持
- 呼び出し側（`provider.ts`, `pullrequest.ts`）の変更は最小限

---

## リスクと対策

| リスク                         | 対策                           |
| ------------------------------ | ------------------------------ |
| GraphQL クエリの複雑さ         | 段階的移行（Phase 1 から開始） |
| レート制限の挙動変化           | クエリのコスト計算を事前検証   |
| ネストデータのページネーション | 必要に応じて追加クエリ         |
| テスト不足                     | ゴールデン比較で出力一致を確認 |

---

## 結論

### 移行の推奨度: **高**

**理由:**

1. **即効性:** タグ取得の N+1 問題解消だけで大きな効果
2. **段階的実施可能:** 低リスクで部分的に導入可能
3. **保守性向上:** 必要なデータのみ取得するため、コードの意図が明確に

### 優先順位

1. **Phase 1（タグ）**: 今すぐ実施可能、最大の ROI
2. **Phase 2（PR）**: 中期的に実施、全体最適化
3. **Phase 3（リリース検出）**: Phase 2 完了後

### 期待効果

| 指標            | 改善率         |
| --------------- | -------------- |
| API コール数    | 95% 削減       |
| データ転送量    | 80-85% 削減    |
| 処理時間        | 10-20 倍高速化 |
| Rate Limit 消費 | 大幅削減       |
