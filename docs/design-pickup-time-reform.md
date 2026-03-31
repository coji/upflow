# pickup_time 定義改修 設計書

## 1. 目的

この設計書は、`pickup_time` を「PR 作成から初回レビューまで」ではなく、**有効なレビュー待ち区間の合計**として再定義するための実装指示書です。現行コードを前提に、以下を同時に満たします。

- `ReviewRequestedEvent` / `ReviewRequestRemovedEvent` / `ReadyForReviewEvent` / `ConvertToDraftEvent` を解釈する状態機械で `pickup_time` を導出する
- `firstReviewedAt` を discussions と reviews の統合最小時刻で定義し直す
- bot / mannequin / author を起点と終点の両方で同じルールで除外する
- 単一 PR の timeline / discussions 取得をページングし、compare / refresh / crawl で同じ完全性契約を使う
- 履歴データに対しても新定義を反映できるロールアウト手順を持つ
- export 契約、性能影響、テスト計画まで実装可能な粒度で明文化する

このタスクでは runtime 実装は行わず、後続の実装ステップがそのままコードに落とせることを完了条件とします。

## 2. 現状コードの把握

### 2.1 現在のデータ経路

| 層                                                                                                                             | 現在の役割                                                                                                                     | 現状の問題                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `batch/github/fetcher.ts`                                                                                                      | GitHub GraphQL / REST から PR 詳細を取得する                                                                                   | `timelineItems(pullNumber)` は `first: 100` 固定でページングなし。`comments()` も review thread comment を inner page まで取り切れていない。`pullrequestsWithDetails()` は nested timeline / nested review thread comments が truncate されても `needsMore*` を出すだけ |
| `batch/github/store.ts`                                                                                                        | raw JSON を `github_raw_data` に保存し、`createStore().loader` から再読込する                                                  | `recalculate` はこの raw JSON だけを読むので、raw timeline が空または不完全だと新定義を再計算できない                                                                                                                                                                   |
| `batch/github/pullrequest.ts`                                                                                                  | `buildPullRequests` が raw データを解析し `pull_requests` / `pull_request_reviews` / `pull_request_reviewers` 相当の配列を作る | `computeDates()` が `first(discussions) ?? first(reviews)` と配列先頭に依存し、timeline を pickup 算出に使っていない                                                                                                                                                    |
| `batch/bizlogic/cycletime.ts`                                                                                                  | `codingTime` / `pickupTime` / `reviewTime` / `deployTime` / `totalTime` を計算する                                             | すべて scalar 境界前提で、複数のレビュー待ち区間を扱えない                                                                                                                                                                                                              |
| `app/services/jobs/crawl.server.ts`                                                                                            | GitHub から raw 詳細を再取得して保存し、analyze -> upsert -> export まで行う                                                   | `fetcher.timelineItems()` は 100 件で打ち切り、`fetcher.comments()` も review thread comments を fully paged 取得できていない。さらに refresh failure を warning で流すため rollout 原子性がない                                                                        |
| `app/services/jobs/recalculate.server.ts`                                                                                      | raw JSON から再解析だけを行う                                                                                                  | raw timeline / raw review actor type を取り直さないので、欠損や旧 JSON shape を直せない                                                                                                                                                                                 |
| `app/services/jobs/backfill.server.ts` / `batch/github/backfill-repo.ts`                                                       | PR metadata または files のみを補完する                                                                                        | timeline / reviews / discussions を補完しないため、この機能のロールアウト手段としては不十分                                                                                                                                                                             |
| `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`                                                        | compare / refresh で単一 PR の raw データ差分確認と再取得を行う                                                                | `fetcher.timelineItems()` / `fetcher.comments()` をそのまま使うため、現在は大きい PR の timeline や review thread comments が欠けうる                                                                                                                                   |
| export 系 (`batch/db/queries.ts`, `batch/bizlogic/export-spreadsheet.ts`, `build-export-data.server.ts`, `DATA_DICTIONARY.md`) | 分析済み列を spreadsheet / Parquet / ドキュメントへ公開する                                                                    | `coding_time` / `pickup_time` / `first_reviewed_at` の意味変更が未反映                                                                                                                                                                                                  |

### 2.2 現在の挙動とこの設計で直す点

- `pickup_time` は `pull_request_created_at -> first_reviewed_at` で計算されている
- `firstReviewedAt` は `discussions` 配列先頭を優先し、なければ `reviews` 配列先頭を見る
- `buildRequestedAtMap()` は `ReviewRequestedEvent` の最新時刻を reviewer ごとに持つが、bot / mannequin / author を除外していない
- `pull_request_reviewers.requested_at` は review bottleneck / workload 系クエリの pending queue 判定にも使われているが、その consumer 契約が設計に明文化されていない
  - `app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts#getQueueHistoryRawData()`
  - `app/routes/$orgSlug/workload/+functions/stacks.server.ts#getPendingReviewAssignments()`
  - `app/routes/$orgSlug/workload/+functions/stacks.server.ts#getOpenPullRequests()` の `hasAnyReviewer`
  - `app/routes/$orgSlug/workload/$login/+functions/queries.server.ts#getBacklogDetails()`
- `comments()` は issue comments 自体はページングしているが、`reviewThreads.comments(first: 100)` の inner page を追わないため、101 件目以降の review thread comment が `firstReviewedAt` 候補から欠けうる
- `recalculate` は raw JSON を再利用するだけなので、古い `timeline_items` や旧 shape の `reviews` / `discussions` は直らない
- `fetcher.comments()` が返す値はすでに issue comments と review thread comments の union だが、`batch/github/types.ts` / `batch/github/store.ts` / `batch/github/pullrequest.ts` の `discussions` 型はまだ `ShapedGitHubReviewComment[]` 固定で、typed path が実データ契約に追いついていない

## 3. 新しい定義

### 3.1 用語

| 用語                        | 定義                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| eligible reviewer           | login が存在し、PR author ではなく、`actorType` / `reviewerType` が `User` で、かつ `botLogins` に含まれない人物 |
| qualifying review activity  | eligible reviewer による discussion comment (`createdAt`) または submitted review (`submittedAt`)                |
| active review-wait interval | PR が ready 状態で、eligible reviewer の outstanding request が 1 人以上あり、かつ `firstReviewedAt` 前の区間    |
| `pickupStartedAt`           | 最初の active review-wait interval の開始時刻。`coding_time` の終点としてだけ使う内部値で、export 列は追加しない |
| `firstReviewedAt`           | qualifying review activity の最小時刻                                                                            |

### 3.2 actor / target の共通フィルタ

起点と終点で同じ eligibility rule を使います。

```ts
type ActorType = 'User' | 'Bot' | 'Mannequin' | null

function isEligibleReviewer(props: {
  login: string | null
  actorType: ActorType
  authorLogin: string | null
  botLogins: Set<string>
}) {
  const login = props.login?.toLowerCase()
  if (!login) return false
  if (props.actorType !== 'User') return false
  if (props.authorLogin && login === props.authorLogin.toLowerCase())
    return false
  if (props.botLogins.has(login)) return false
  return true
}
```

このルールを以下の両方に適用します。

- timeline 上の `ReviewRequestedEvent` / `ReviewRequestRemovedEvent` の `requestedReviewer`
- discussions / reviews の actor

終点側は「現在 pending set に残っている reviewer だけ」に限定しません。`firstReviewedAt` は、**同じ eligibility rule を満たす最初の人間レビュー活動**で確定します。

そのため、raw JSON には次の type 情報を保持します。

- `ShapedGitHubPullRequest.reviewers[]`: `reviewerType`
- `ShapedTimelineItem`: `reviewerType`
- `ShapedGitHubIssueComment` / `ShapedGitHubReviewComment` / `ShapedGitHubReview`: `actorType`

`pull_request_reviewers` は現行どおり「現在 outstanding な reviewer snapshot」を表すため、snapshot 生成側で reviewer type を失わないことが必要です。現状の `isBot: boolean` だけでは mannequin を終点側でも snapshot 側でも除外できません。

### 3.3 type 情報の取得元

filter を実装可能にするため、type 情報の source は raw shape ごとに固定します。

| raw shape                             | type field     | 取得元                                                                                                      |
| ------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `ShapedGitHubPullRequest.reviewers[]` | `reviewerType` | `pullrequests()` / `pullrequestsWithDetails()` が読む `reviewRequests.nodes[].requestedReviewer.__typename` |
| `ShapedTimelineItem`                  | `reviewerType` | `ReviewRequestedEvent` / `ReviewRequestRemovedEvent` の `requestedReviewer.__typename`                      |
| `ShapedTimelineItem`                  | `actorType`    | `ReadyForReviewEvent` / `ConvertToDraftEvent` など actor を持つ timeline item の `actor.__typename`         |
| `ShapedGitHubIssueComment`            | `actorType`    | issue comment の `author.__typename`                                                                        |
| `ShapedGitHubReviewComment`           | `actorType`    | review thread comment の `author.__typename`                                                                |
| `ShapedGitHubReview`                  | `actorType`    | review の `author.__typename`                                                                               |

reviewer snapshot の filter は `pr.reviewers[].reviewerType` を唯一の source とします。snapshot 生成時に reviewer type を落とさない限り、author / bot / mannequin の除外は timeline 再走査なしで実装できます。

## 4. メトリクスの意味

### 4.1 新しいメトリクス境界

```text
first_commit ---- pickupStartedAt ---- firstReviewedAt ---- mergedAt ---- releasedAt
       |-------------- coding_time --------------|
                         |== sum(active waits) ==|  = pickup_time
                                              |---- review_time ----|
                                                                   |-- deploy_time --|
```

### 4.2 各指標

| 指標          | 新定義                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coding_time` | `first_committed_at -> pickupStartedAt`。fully refreshed raw data 上で `pickupStartedAt` が一度も発生しない PR だけ `first_committed_at -> pull_request_created_at` を使う |
| `pickup_time` | active review-wait interval の合計。draft 期間、review request が 0 の期間、request removed 後の期間は含めない                                                             |
| `review_time` | `firstReviewedAt -> mergedAt`。定義変更なし                                                                                                                                |
| `deploy_time` | `mergedAt -> releasedAt`。定義変更なし                                                                                                                                     |
| `total_time`  | 既存どおり「最初の利用可能な開始時刻」から「最後の利用可能な終了時刻」までの end-to-end elapsed time。`pickupStartedAt` や raw `ReviewRequestedEvent` は候補に含めない     |

### 4.3 `total_time` に request 境界を入れない理由

`total_time` は phase split 用ではなく end-to-end 用です。`pickupStartedAt` は内部境界であり、これを候補に追加しても min/max は通常変わりません。にもかかわらず候補へ入れると「`total_time` が request ベースで再定義された」と読めてしまうため、**`total_time` は変更しません**。

結果として、`coding_time + pickup_time + review_time + deploy_time` は今後も常に `total_time` と一致するとは限りません。特に request removed 後の gap や draft へ戻した期間は `total_time` には含まれますが `pickup_time` には含まれません。

## 5. 取得と正規化の契約

### 5.1 fetcher が担うこと

`batch/github/fetcher.ts` は **完全な raw データを返す責務** を持ちます。

- `comments()` は issue comments と review thread comments の **両方** を fully paged で返す
- `reviews()` は現状どおり全ページ取得を継続
- `timelineItems(pullNumber)` は `after: $cursor` を持つ query に変更し、`hasNextPage === false` になるまで全ページ取得する
- `pullrequests()` / `pullrequestsWithDetails()` で取得する current reviewer snapshot は `login` に加えて `reviewerType` を保持する
- compare / refresh / crawl は全てこの `timelineItems()` を使う
- 部分ページしか取れなかった場合は配列を返さず throw する。partial timeline / partial discussions の save は禁止

`comments()` の完全性契約:

- issue comments は現状どおり `comments.pageInfo.hasNextPage === false` までページングする
- review thread comments は「thread 一覧のページング」と「各 thread の comment ページング」の両方を完了してから返す
- `reviewThreads.pageInfo.hasNextPage === true` または任意の `thread.comments.pageInfo.hasNextPage === true` を検知した時点で follow-up fetch を完了できない実装は不完全とみなし、保存前に throw する

review thread comments の取得方法は GraphQL の nested pagination helper でも REST の review comment 一括取得でもよいですが、**authoritative raw discussions は fully paged でなければ保存しない** ことを契約とします。

コードイメージ:

```ts
const timelineItems = async (
  pullNumber: number,
): Promise<ShapedTimelineItem[]> => {
  const items: ShapedTimelineItem[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const result = await graphqlWithTimeout(query, {
      owner,
      repo,
      number: pullNumber,
      cursor,
    })
    const connection = result.repository?.pullRequest?.timelineItems
    if (!connection?.nodes)
      throw new Error(`timelineItems missing for PR #${pullNumber}`)
    items.push(...shapeTimelineNodes(connection.nodes))
    hasNextPage = connection.pageInfo.hasNextPage
    cursor = connection.pageInfo.endCursor ?? null
  }

  return items
}
```

### 5.2 `pullrequestsWithDetails()` の扱い

`pullrequestsWithDetails()` の nested timeline (`first: 50`) と nested review thread comments (`comments(first: 20)`) は現状 crawl 経路で使っていません。この機能の実装では **authoritative source にしない** ことを明記します。

- raw timeline を保存する経路は `fetcher.timelineItems()` だけを使う
- raw discussions を保存する経路は fully paged `fetcher.comments()` だけを使う
- `pullrequestsWithDetails()` を将来再利用する場合は、timeline についても同じ fully paged helper を呼ぶか、`needsMoreTimelineItems` が true の PR を解析対象外にする
- 同様に discussions についても `needsMoreReviewThreadComments` が true の PR を authoritative path に流さない

### 5.3 `discussions` の typed boundary

authoritative raw discussions は issue comments と review thread comments の union です。この契約を `fetcher.ts` の内部だけに閉じ込めず、既存の typed surface 全体へ通します。

```ts
export type ShapedGitHubDiscussion =
  | ShapedGitHubIssueComment
  | ShapedGitHubReviewComment

// batch/github/types.ts
discussions: (number: number) => Promise<ShapedGitHubDiscussion[]>

// batch/github/store.ts
interface ParsedRow {
  discussions: ShapedGitHubDiscussion[]
}

// batch/github/pullrequest.ts
interface PrArtifacts {
  discussions: ShapedGitHubDiscussion[]
}
```

要件:

- `batch/github/model.ts` に `ShapedGitHubDiscussion` alias を追加し、`ShapedGitHubPullRequestWithDetails.comments` と同じ union を共有する
- `batch/github/types.ts` の loader contract を `Promise<ShapedGitHubDiscussion[]>` へ広げる
- `batch/github/store.ts` の `ParsedRow`, `savePrData()`, `loader.discussions()` を同じ alias へ揃える
- `batch/github/pullrequest.ts` は `computeFirstReviewedAt()` など discussion reader を union 前提で書き、issue comment / review thread comment が 1 本の ordered stream として扱われることを型で保証する

これにより、`pullrequestsWithDetails().comments` と raw store / analyze path の間で「実データは union だが型は review comment only」というズレをなくします。

### 5.4 正規化の責務は `buildPullRequests`

`batch/github/pullrequest.ts` が、raw JSON から状態機械と `firstReviewedAt` が使う ordered stream を組み立てます。理由は以下です。

- `recalculate` は DB に保存済み raw JSON を読むため、fetch 時点の配列順に依存させないほうが安全
- `reviews()` は現状ソートしていない
- raw JSON shape が将来増えても、イベント解釈の責務を 1 箇所に閉じ込められる

正規化ルール:

| ストリーム     | 使用時刻      | 並び順                                           |
| -------------- | ------------- | ------------------------------------------------ |
| timeline items | `createdAt`   | `createdAt ASC` -> event precedence -> login ASC |
| discussions    | `createdAt`   | `createdAt ASC` -> `id ASC`                      |
| reviews        | `submittedAt` | `submittedAt ASC` -> `id ASC`                    |

timeline の同一 timestamp tie-break は次の順です。

1. `ConvertToDraftEvent`
2. `ReviewRequestRemovedEvent`
3. `ReadyForReviewEvent`
4. `ReviewRequestedEvent`
5. その他の timeline item (`type` 昇順)

この順序にする理由:

- close 系イベントを open 系イベントより先に適用し、同秒イベントで active interval が負にならないようにする
- `ReadyForReviewEvent` と `ReviewRequestedEvent` が同秒でも、ready になった直後の request として 0 秒待ちを表現できるようにする

```ts
const TIMELINE_ORDER: Record<string, number> = {
  ConvertToDraftEvent: 0,
  ReviewRequestRemovedEvent: 1,
  ReadyForReviewEvent: 2,
  ReviewRequestedEvent: 3,
}

function compareTimeline(
  a: NormalizedTimelineEvent,
  b: NormalizedTimelineEvent,
) {
  return (
    a.createdAt.localeCompare(b.createdAt) ||
    (TIMELINE_ORDER[a.type] ?? 9) - (TIMELINE_ORDER[b.type] ?? 9) ||
    a.subjectLogin.localeCompare(b.subjectLogin)
  )
}
```

## 6. `firstReviewedAt` の定義

### 6.1 導出ルール

`firstReviewedAt` は次で定義します。

1. fully paged discussions（issue comments + review thread comments）から eligible reviewer の comment を候補化する
2. reviews から eligible reviewer の submitted review (`state !== 'PENDING'`) を候補化する
3. 2 つを結合して最小時刻を取る

discussion と review のどちらを先に見るかは関係なく、**1 本の候補列にして最小時刻を取る** のが契約です。

### 6.2 コード例

```ts
function computeFirstReviewedAt(
  pr: ShapedGitHubPullRequest,
  artifacts: PrArtifacts,
  botLogins: Set<string>,
): string | null {
  const discussionCandidates = artifacts.discussions.flatMap((comment) => {
    return isEligibleReviewer({
      login: comment.user,
      actorType: comment.actorType,
      authorLogin: pr.author,
      botLogins,
    })
      ? [
          {
            occurredAt: comment.createdAt,
            source: 'discussion' as const,
            id: comment.id,
          },
        ]
      : []
  })

  const reviewCandidates = artifacts.reviews.flatMap((review) => {
    if (!review.submittedAt || review.state === 'PENDING') return []
    return isEligibleReviewer({
      login: review.user,
      actorType: review.actorType,
      authorLogin: pr.author,
      botLogins,
    })
      ? [
          {
            occurredAt: review.submittedAt,
            source: 'review' as const,
            id: review.id,
          },
        ]
      : []
  })

  const candidates = [...discussionCandidates, ...reviewCandidates].sort(
    (a, b) => {
      return (
        a.occurredAt.localeCompare(b.occurredAt) ||
        a.source.localeCompare(b.source) ||
        String(a.id).localeCompare(String(b.id))
      )
    },
  )

  return candidates[0]?.occurredAt ?? null
}
```

## 7. review-wait 状態機械

### 7.1 状態

| 状態           | 意味                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| `DraftIdle`    | PR は draft。outstanding eligible reviewer は保持してよいが、pickup は進まない                |
| `ReadyIdle`    | PR は ready。outstanding eligible reviewer が 0 人                                            |
| `ReadyWaiting` | PR は ready。outstanding eligible reviewer が 1 人以上。ここだけが `pickup_time` に加算される |
| `Reviewed`     | `firstReviewedAt` に到達した終端状態。以降 pickup は進まない                                  |

### 7.2 初期状態の決め方

初期状態は `inferInitialState(pr, normalizedTimeline)` で決めます。`ShapedGitHubPullRequest.draft` は既に raw PR に保存されているため、draft-related event が見つからないケースの fallback に使います。

- 最初の draft-related event が `ReadyForReviewEvent` の場合: PR は作成時 `DraftIdle`
- 最初の draft-related event が `ConvertToDraftEvent` の場合: PR は作成時 `ReadyIdle`
- draft-related event がない場合: `pr.draft === true` なら `DraftIdle`、それ以外は `ReadyIdle`

これにより、作成時 draft -> ready の PR でも `ReadyForReviewEvent` 以前を inactive として扱えます。また、履歴上 draft event が欠けていても、current raw PR shape の `draft` フラグと矛盾しない初期状態を選べます。

```ts
function inferInitialState(
  pr: ShapedGitHubPullRequest,
  normalizedTimeline: NormalizedTimelineEvent[],
) {
  const firstDraftEvent = normalizedTimeline.find(
    (event) =>
      event.type === 'ReadyForReviewEvent' ||
      event.type === 'ConvertToDraftEvent',
  )

  if (firstDraftEvent?.type === 'ReadyForReviewEvent') return 'DraftIdle'
  if (firstDraftEvent?.type === 'ConvertToDraftEvent') return 'ReadyIdle'
  return pr.draft ? 'DraftIdle' : 'ReadyIdle'
}
```

### 7.3 状態遷移図

```text
DraftIdle
  -- ReadyForReviewEvent & pending=0 --> ReadyIdle
  -- ReadyForReviewEvent & pending>0 --> ReadyWaiting (interval start)
  -- ReviewRequestedEvent(eligible) --> DraftIdle
  -- ReviewRequestRemovedEvent(eligible) --> DraftIdle

ReadyIdle
  -- ReviewRequestedEvent(eligible) --> ReadyWaiting (interval start)
  -- ConvertToDraftEvent --> DraftIdle

ReadyWaiting
  -- ReviewRequestedEvent(eligible) --> ReadyWaiting
  -- ReviewRequestRemovedEvent(last eligible removed) --> ReadyIdle (interval close)
  -- ConvertToDraftEvent --> DraftIdle (interval close)
  -- firstReviewedAt --> Reviewed (interval close)

ReadyIdle / DraftIdle
  -- firstReviewedAt --> Reviewed
```

### 7.4 遷移表

| 現在状態       | 入力                                   | 内部更新                | 次状態                                                   | 区間処理                    |
| -------------- | -------------------------------------- | ----------------------- | -------------------------------------------------------- | --------------------------- |
| `DraftIdle`    | `ReviewRequestedEvent` (eligible)      | pending reviewer を追加 | `DraftIdle`                                              | なし                        |
| `DraftIdle`    | `ReviewRequestRemovedEvent` (eligible) | pending reviewer を削除 | `DraftIdle`                                              | なし                        |
| `DraftIdle`    | `ReadyForReviewEvent`                  | `isDraft = false`       | pending が 0 なら `ReadyIdle`、1 以上なら `ReadyWaiting` | pending が 1 以上なら開始   |
| `ReadyIdle`    | `ReviewRequestedEvent` (eligible)      | pending reviewer を追加 | `ReadyWaiting`                                           | 開始                        |
| `ReadyIdle`    | `ConvertToDraftEvent`                  | `isDraft = true`        | `DraftIdle`                                              | なし                        |
| `ReadyWaiting` | `ReviewRequestedEvent` (eligible)      | pending reviewer を追加 | `ReadyWaiting`                                           | 継続                        |
| `ReadyWaiting` | `ReviewRequestRemovedEvent` (eligible) | pending reviewer を削除 | pending が 0 なら `ReadyIdle`、それ以外は `ReadyWaiting` | pending が 0 になったら終了 |
| `ReadyWaiting` | `ConvertToDraftEvent`                  | `isDraft = true`        | `DraftIdle`                                              | 終了                        |
| 任意           | `firstReviewedAt` 到達                 | なし                    | `Reviewed`                                               | `ReadyWaiting` なら終了     |

### 7.5 導出アルゴリズム

```ts
interface ReviewWaitResult {
  pickupStartedAt: string | null
  pickupTimeMs: number | null
}

function deriveReviewWait(
  pr: ShapedGitHubPullRequest,
  normalizedTimeline: NormalizedTimelineEvent[],
  firstReviewedAt: string | null,
): ReviewWaitResult {
  const cutoff = firstReviewedAt ?? pr.mergedAt ?? null
  const pending = new Set<string>()
  let state = inferInitialState(pr, normalizedTimeline)
  let activeSince: string | null = null
  let pickupStartedAt: string | null = null
  let pickupMs = 0

  for (const event of normalizedTimeline) {
    if (cutoff && event.createdAt > cutoff) break

    if (event.type === 'ReviewRequestedEvent') pending.add(event.subjectLogin)
    if (event.type === 'ReviewRequestRemovedEvent')
      pending.delete(event.subjectLogin)
    if (event.type === 'ReadyForReviewEvent') state = 'ready'
    if (event.type === 'ConvertToDraftEvent') state = 'draft'

    const shouldBeActive = state === 'ready' && pending.size > 0
    if (!activeSince && shouldBeActive) {
      activeSince = event.createdAt
      pickupStartedAt ??= event.createdAt
    }
    if (activeSince && !shouldBeActive) {
      pickupMs += Date.parse(event.createdAt) - Date.parse(activeSince)
      activeSince = null
    }
  }

  if (activeSince && cutoff) {
    pickupMs += Date.parse(cutoff) - Date.parse(activeSince)
  }

  if (!cutoff) return { pickupStartedAt, pickupTimeMs: null }
  if (!pickupStartedAt) return { pickupStartedAt: null, pickupTimeMs: null }
  return { pickupStartedAt, pickupTimeMs: pickupMs }
}
```

### 7.6 例

#### 例 1: draft 往復

```text
10:00 ReviewRequested(Alice)   -- draft 中なので inactive
11:00 ReadyForReview           -- interval #1 start
12:00 ConvertToDraft           -- interval #1 end
13:00 ReadyForReview           -- interval #2 start
15:00 Discussion by Alice      -- firstReviewedAt, interval #2 end
pickup_time = (12:00-11:00) + (15:00-13:00) = 3h
coding_time ends at 11:00
```

#### 例 2: request / remove / re-request

```text
10:00 ReviewRequested(Alice)   -- interval #1 start
12:00 ReviewRequestRemoved(Alice) -- interval #1 end
16:00 ReviewRequested(Bob)     -- interval #2 start
18:00 Review submitted by Bob  -- firstReviewedAt, interval #2 end
pickup_time = 4h
```

#### 例 3: bot request は無視

```text
10:00 ReviewRequested(ci-bot)  -- ineligible, ignored
12:00 ReviewRequested(Alice)   -- interval start
13:00 Comment by ci-bot        -- ineligible, firstReviewedAt は確定しない
15:00 Review by Alice          -- firstReviewedAt
pickup_time = 3h
```

## 8. 実装時のモジュール変更マップ

| ファイル                                                                              | 変更内容                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `batch/github/model.ts`                                                               | `ShapedGitHubPullRequest.reviewers[]` に `reviewerType`、`ShapedTimelineItem` に `reviewerType` / `actorType`、`ShapedGitHubIssueComment` / `ShapedGitHubReviewComment` / `ShapedGitHubReview` に `actorType` を追加                                                                                                                               |
| `batch/github/types.ts`                                                               | `PullRequestLoaders.discussions` を `Promise<ShapedGitHubDiscussion[]>` へ広げ、issue comment / review thread comment の union を store/analyze 側まで保持する                                                                                                                                                                                     |
| `batch/github/fetcher.ts`                                                             | single-PR timeline query をページング対応。`comments()` で issue comments / review thread comments を fully paged 取得し、partial discussions を保存しない。`shapeTimelineNodes()` / reviewer snapshot / comments / reviews で type 情報を保持する                                                                                                 |
| `batch/github/pullrequest.ts`                                                         | `loadPrArtifacts()` に timeline を含め、`discussions` を `ShapedGitHubDiscussion[]` へ更新する。`normalizeTimelineEvents()` / `computeFirstReviewedAt()` / `deriveReviewWait()` を追加。`inferInitialState(pr, timeline)` は `pr.draft` fallback を使う。`computeDates()` は配列先頭依存をやめ、`pickupStartedAt` / `firstReviewedAt` ベースにする |
| `batch/bizlogic/cycletime.ts`                                                         | `codingTime` は `pickupStartedAt` を終点候補に取る。`pickupTime` は state machine が返した `pickupTimeMs` を days へ変換する責務に寄せる。`totalTime` は既存 min/max contract を維持し、request 境界を入れない                                                                                                                                     |
| `batch/github/store.ts`                                                               | DB schema 変更は不要。raw JSON shape の拡張をそのまま保存・読込する。特に `discussions` は `ShapedGitHubDiscussion[]` として parse/save し、typed path の narrowing を残さない                                                                                                                                                                     |
| `app/services/jobs/crawl.server.ts`                                                   | 高レベルの flow は維持。ただし `refresh=true` では detail fetch failure を収集し、1 件でも失敗があれば analyze / upsert / export に進まない strict refresh contract を入れる。成功時のみ raw save -> analyze まで一貫して新定義を適用する                                                                                                          |
| `app/services/jobs/recalculate.server.ts`                                             | 高レベルの flow は維持。ただし rollout 手順では successful refresh crawl 後にのみ許可し、failed refresh org に対しては再 refresh 完了前の recalculate を運用禁止とする                                                                                                                                                                             |
| `app/services/jobs/backfill.server.ts` / `batch/github/backfill-repo.ts`              | この reform の移行手段には使わない。help / docs 上で「metadata backfill では pickup reform は反映されない」と明記する                                                                                                                                                                                                                              |
| `batch/cli.ts`                                                                        | `backfill` help text から「この種の raw detail 変更には `crawl --refresh` を使う」ことが分かるようにする                                                                                                                                                                                                                                           |
| `batch/db/queries.ts`                                                                 | spreadsheet export の列はそのまま。値の意味だけ更新されるので change log を同期する                                                                                                                                                                                                                                                                |
| `batch/bizlogic/export-spreadsheet.ts`                                                | 列名は維持。`codingTime` / `pickupTime` の説明文と運用告知を更新する                                                                                                                                                                                                                                                                               |
| `app/routes/$orgSlug/settings/data-management/+functions/build-export-data.server.ts` | `first_reviewed_at` / `coding_time` / `pickup_time` / reviewer JSON `requested_at` の contract を設計どおりに説明し、必要なら test を追加する                                                                                                                                                                                                      |
| `app/routes/$orgSlug/settings/data-management/+data/DATA_DICTIONARY.md`               | 変更後の列意味を具体的に追記する                                                                                                                                                                                                                                                                                                                   |
| `app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts`                   | `pull_request_reviewers.requested_at` を queue start として読む consumer 契約を新定義に合わせて確認し、author / bot / mannequin / removed reviewer が backlog に混ざらない前提を test で固定する                                                                                                                                                   |
| `app/routes/$orgSlug/workload/+functions/stacks.server.ts`                            | `pull_request_reviewers` を current outstanding reviewer snapshot として使う前提を維持し、eligible reviewer だけが reviewer stack に出るようにする                                                                                                                                                                                                 |
| `app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`                    | author backlog / pendingReviews が `requested_at` 非 null の current eligible reviewer snapshot のみを見る契約を明文化し、回帰 test を追加する                                                                                                                                                                                                     |
| `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`               | compare / refresh が fully paged timeline / discussions を使い、partial raw detail を保存しないようにする                                                                                                                                                                                                                                          |

## 9. ロールアウトと既存データ移行

### 9.1 `recalculate` だけでは足りない理由

`recalculate` は `analyze-worker.ts -> createStore().loader -> buildPullRequests()` で **既存の raw JSON を読み直すだけ** です。したがって以下は直りません。

- `github_raw_data.timeline_items` が `NULL` / `[]`
- 旧 fetcher によって 100 件で切られた non-empty timeline
- 旧 shape の `pull_request` / `reviews` / `discussions`（`reviewerType` / `actorType` が入っていない）

このため、歴史データへ新定義を反映する canonical path は **`crawl --refresh`** です。

### 9.2 canonical migration path

1. 新コードをデプロイする
2. 組織ごとに full refresh crawl を実行する

```bash
pnpm tsx batch/cli.ts crawl <organization-id> --refresh
```

3. `refresh=true` の rollout run では、org 内の全対象 PR detail fetch が同一 run で成功したときだけ downstream を更新する
4. zero-failure run のときだけ以下が同時に行われる
   - GitHub から `commits` / `reviews` / `discussions` / `timelineItems` / `files` を再取得
   - `github_raw_data` を新 JSON shape と fully paged timeline / discussions で上書き
   - `buildPullRequests()` による再解析
   - `pull_requests` / `pull_request_reviews` / `pull_request_reviewers` の upsert
   - export の再生成
5. successful refresh crawl の後に追加の `recalculate` は不要

### 9.3 rollout 完了条件と failure path

`crawl --refresh` は現状 PR 単位 fetch failure を warning で流せますが、この reform の rollout 完了条件はそれより厳しく定義します。

- org rollout 完了 = 対象 org の `crawl --refresh` が **1 run 内で全 PR detail fetch 成功 + analyze + upsert + export 完了** した状態
- 1 PR でも `commits` / `reviews` / `discussions` / `timelineItems` / `files` の再取得に失敗した run は rollout 未完了
- rollout 未完了 run では analyze / upsert / export を実行しない。raw が部分的に更新されても、その run を semantic source of truth にしない
- rollout 未完了の org に対して `recalculate` を続けて実行してはいけない。まず同じ `crawl --refresh` を再実行して zero-failure run を作る
- `crawl --refresh` の再実行は冪等: 失敗 PR だけでなく全 PR の detail を再取得するため、前回 run で部分更新された stale raw が残ることはない。再実行で zero-failure に到達すれば、全 PR の raw が新 shape で揃う

実装イメージ:

```ts
const refreshFailures: Array<{ repoId: string; prNumber: number }> = []

// detail fetch loop
if (!saved.saved) refreshFailures.push({ repoId: repo.id, prNumber: pr.number })

if (input.refresh && refreshFailures.length > 0) {
  throw new Error(
    `refresh incomplete: ${refreshFailures.length} PRs failed detail refresh`,
  )
}

await analyzeAndFinalizeSteps(...)
```

この gate により、org 単位の公開データ（`pull_requests` / exports）は partial refresh run で更新されません。

### 9.4 なぜ `crawl --refresh` を選ぶのか

- timeline だけでなく `reviews` / `discussions` の actor type も更新できる
- `timeline_items` が non-empty でも truncate されている可能性があるため、`NULL` / `[]` の PR だけを対象にしても不十分
- current `backfill` は metadata / files 用であり、この reform に必要な raw detail rewrite を行わない

ロールアウトの実行イメージ:

```ts
async function runPickupTimeMigration(orgId: string) {
  await crawlCommand({ organizationId: orgId, refresh: true })
  // zero-failure refresh already does:
  // fetch raw details -> save github_raw_data -> analyze -> upsert -> export
  // so no follow-up recalculate is required here
}
```

### 9.5 compare / refresh の扱い

単一 PR の手動導線は rollout の補助手段として残します。

- `compare`: GitHub 側の commits / comments / reviews / timelineItems を fully paged で取得して差分表示
- `refresh`: 同じ fully paged raw detail を保存し、その場で `buildPullRequests()` を 1 PR 分だけ再実行して upsert

つまり compare / refresh も crawl と同じ timeline / discussions 完全取得ルールを使います。大きい PR で compare が見えているコメント列や timeline と batch が保存する raw detail がズレる状態は作りません。

### 9.6 運用上の注意

- semantic change は org 単位で zero-failure `crawl --refresh` 完了後に有効化されたとみなす
- ダッシュボード / export を見る利用者には「refresh 完了前後で `coding_time` / `pickup_time` の定義が変わる」ことを事前告知する
- rollout 中に job が中断した org、または一部 PR detail refresh に失敗した org は、同じ `crawl --refresh` を再実行して zero-failure run を作るまで未完了扱いにする

## 10. 公開契約

### 10.1 `DATA_DICTIONARY.md` に追記する内容

最低限、以下の説明へ更新します。

```md
| `first_reviewed_at` | datetime? | Earliest qualifying human review activity across discussions and submitted reviews. Author, bots, and mannequins are excluded. |
| `coding_time` | float? | Time from first commit to the first active review-wait start. If no active review-wait interval is ever created, the endpoint remains pull_request_created_at. |
| `pickup_time` | float? | Sum of active review-wait intervals while the PR is ready and has at least one eligible requested reviewer. Draft periods and request-free gaps are excluded. |
```

cycle time 図も `pull_request_created_at` ではなく `pickupStartedAt` ベースの説明へ差し替えます。

### 10.2 export への影響

- spreadsheet (`rawdata` sheet) の `codingTime` / `pickupTime`
- Parquet / ZIP export の `coding_time` / `pickup_time`
- `first_reviewed_at`

は **列名据え置きで意味だけ変わります**。そのため、consumer には破壊的変更として周知します。

### 10.3 reviewer JSON の `requested_at`

`build-export-data.server.ts` の reviewer JSON での `requested_at` は、PR 全体の `pickupStartedAt` ではありません。意味は次のとおりです。

- `pull_request_reviewers` に残る **current outstanding reviewer snapshot** 行に紐づく request timestamp
- bot / mannequin / author 向け request は除外後の値
- re-request がある reviewer は最新の eligible request を保持

この値は reviewer 粒度の補助情報であり、PR レベルの `pickup_time` の再計算元ではないことを `DATA_DICTIONARY.md` に明記します。

### 10.4 `requested_at` の内部 consumer 契約

`pull_request_reviewers.requested_at` は export だけでなく、以下の内部 consumer でも pending queue / workload の基準時刻として使われています。

- `app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts`
- `app/routes/$orgSlug/workload/+functions/stacks.server.ts`
- `app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`

このため、reform 後も `pull_request_reviewers` の意味は **historical request log ではなく current outstanding eligible reviewer snapshot** のまま維持します。各 consumer が依存している yes/no 契約は次です。

- reviewer row が存在する = その reviewer は現在も outstanding request を持つ
- `requested_at` = その snapshot に対応する最新の eligible request 時刻
- removed reviewer、author、bot、mannequin は row 自体を作らない
- PR レベルの `pickupStartedAt` と reviewer row の `requested_at` は別概念であり、相互代用しない

これにより、review bottleneck の queue history / workload の pending assignment は「現在 outstanding な request だけ」を読み続けられます。

#### 関数単位の依存先

| ファイル                                                            | 関数                            | `pull_request_reviewers` への依存                                                                                            |
| ------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts` | `getQueueHistoryRawData()`      | `requested_at` を queue start とみなし、`pull_request_reviews` の最初の resolved review までの pending 区間を作る            |
| `app/routes/$orgSlug/workload/+functions/stacks.server.ts`          | `getPendingReviewAssignments()` | `requested_at IS NOT NULL` の current outstanding reviewer row を reviewer-side stack に出す                                 |
| `app/routes/$orgSlug/workload/+functions/stacks.server.ts`          | `getOpenPullRequests()`         | `pull_request_reviewers` の `EXISTS` で author-side `hasAnyReviewer` を作る                                                  |
| `app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`  | `getBacklogDetails()`           | author backlog の `hasReviewer` と reviewer backlog の `pendingReviews` の両方で current outstanding reviewer row を参照する |

この 4 関数は「historical request log ではなく current outstanding eligible reviewer snapshot」を前提にしているため、設計変更で守るべき契約も同じです。

#### consumer ごとの影響分析

影響の本質: `requestedAt` の算出ロジック自体（`buildRequestedAtMap()` で timeline から最新の `ReviewRequestedEvent.createdAt` を取る）は変わらない。変わるのは **`pull_request_reviewers` テーブルに書き込まれる reviewer の集合**。ineligible reviewer（bot / mannequin / author）の行が消え、各 reviewer の `requestedAt` 値も eligible な `ReviewRequestedEvent` のみの最新時刻になる。

| consumer                                                             | 影響                                                                                                                                                                                                                                                                                            | 分類                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `analysis/reviews/+functions/queries.server.ts`                      | bot reviewer の行が `pullRequestReviewers` から消えるため、bot の pending 時間がキュー履歴に含まれなくなる。人間レビュアーの待ち時間だけを計測する目的に合致する                                                                                                                                | 意図した改善                |
| `workload/+functions/stacks.server.ts#getPendingReviewAssignments()` | reviewer-side stack に bot / mannequin / author reviewer が出なくなる。pending review 数は「人が今見るべきレビュー」だけになる                                                                                                                                                                  | 意図した改善                |
| `workload/+functions/stacks.server.ts#getOpenPullRequests()`         | bot-only reviewer の PR で `EXISTS (SELECT ... FROM pullRequestReviewers)` subquery が false になり、`hasAnyReviewer` が変わる。UI 上で「レビュアー未割り当て」扱いになる。これは bot-only 割り当ての PR を人間ワークロードから除外する意味で正しいが、利用者が混乱しないよう運用告知で周知する | 意図した改善（UI 変化あり） |
| `workload/$login/+functions/queries.server.ts#getBacklogDetails()`   | `requestedAt IS NOT NULL` フィルタが使う reviewer 行から bot / mannequin / removed reviewer が消える。author backlog の `hasReviewer` と reviewer backlog の `pendingReviews` の両方で行数が減る                                                                                                | 意図した改善                |

### 10.5 周知方法

1. `DATA_DICTIONARY.md` を runtime 変更と同じ release で更新する
2. export 利用者向け release note に「`coding_time` / `pickup_time` / `first_reviewed_at` の意味変更」と「実施日」を明記する
3. historical rows は org ごとの `crawl --refresh` 完了時に再計算されることを周知する

## 11. パフォーマンス影響

### 11.1 steady-state analyze

- 新規コストは timeline 正規化と state machine replay の CPU です
- 計算量は概ね `O((timeline + discussions + reviews) log n)`。PR 単位で閉じる
- `createStore.loadRow()` は現状でも heavy columns を 1 行まとめて parse し、`timeline_items` も同時に `JSON.parse()` しているため、`recalculate` の DB parse コスト自体は大きく増えない

### 11.2 crawl / compare / refresh

- single PR timeline fetch は「1 call 固定」から「1 + 追加ページ数」に増える
- discussions fetch も issue comments に加えて review thread comments の fully paged 取得が必要になる
- 影響は review churn が多い PR に偏る
- compare / refresh は人手操作なので許容しやすい
- hourly crawl では更新 PR だけが対象なので steady-state 影響は限定的

### 11.3 historical rollout

- `crawl --refresh` は最も重い経路だが、raw `reviews` / `discussions` / `timeline_items` を同時に新 shape へ更新できるため、この reform の移行コストとしては正当
- `recalculate` だけで済ませないことで API call は増えるが、semantic correctness を優先する

### 11.4 メモリと store

- `analyze-worker.ts` は repository ごとに逐次処理し、`buildPullRequests()` も PR ごとに進む
- `createStore.rowCache` は現状どおり load 済み PR を保持するが、新設計で cross-PR の追加バッファは持たない
- `loadPrArtifacts()` で timeline を明示的に読むことで、同じ PR に対する `loaders.timelineItems()` 再呼び出しを避け、意図を明確にする

### 11.5 実装上の mitigation

- partial timeline / partial discussions は保存しない。fail fast で raw の完全性を守る
- `pullrequestsWithDetails()` の truncated timeline / truncated review thread comments は pickup 算出に使わない
- `refresh=true` の rollout run では fetch failure が 1 件でもあれば analyze / upsert / export を止め、公開データを mixed semantics にしない
- normalize / state machine は pure function に寄せ、worker 内で大型中間データを保持しない

## 12. テスト計画

### 12.1 入口は `buildPullRequests`

主戦場は `batch/github/__tests__/buildPullRequests-*.test.ts` の integration test です。`computeDates()` 単体より、`buildPullRequests()` に PR fixture と loaders を与えて最終 row を見る形を優先します。

fixture 方針:

- `makePr`, `makeTimelineItem`, `makeReview`, `makeDiscussion`, `makeReviewerSnapshot` の builder を用意して timestamp と type を毎ケースで明示する
- timeline / reviews / discussions は「時系列そのもの」が読める fixture にする
- bot / mannequin / author のケースでは login と type の両方を fixture へ埋める
- initial state のケースでは `pr.draft` を fixture で必ず明示する

### 12.2 必須ケース

| 分類                   | ケース                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| state machine          | draft -> ready -> draft -> ready の往復で draft 中が pickup に入らない                                                                   |
| state machine          | draft-related event がない PR で `pr.draft === true` のとき `DraftIdle` から始まる                                                       |
| state machine          | draft-related event がない PR で `pr.draft === false` のとき `ReadyIdle` から始まる                                                      |
| state machine          | request -> remove -> re-request で active interval が分割加算される                                                                      |
| state machine          | 複数 reviewer request 中に 1 人を remove しても outstanding が残る限り interval が継続する                                               |
| state machine          | merge without review で active interval が merge 時刻で閉じる                                                                            |
| state machine          | open PR で qualifying review がなく merge もない場合 `pickup_time` が `null`                                                             |
| firstReviewedAt        | discussion と review を混在させ、配列順ではなく最小時刻が採用される                                                                      |
| filtering              | author / bot / mannequin request が起点に使われない                                                                                      |
| filtering              | author / bot / mannequin discussion / review が終点に使われない                                                                          |
| reviewer snapshot      | `pr.reviewers[].reviewerType` を使って author / bot / mannequin を snapshot から除外できる                                               |
| pagination contract    | timeline が 100 件超の PR で全ページ取得される。partial timeline の save をしない                                                        |
| pagination contract    | review thread comments が 100 件超の PR で全ページ取得される。partial discussions の save をしない                                       |
| missing historical raw | old raw row（timeline なし、actorType なし）に対して `recalculate` だけでは修正されないことを job test で明示する                        |
| rollout                | zero-failure `crawl --refresh` 後は raw detail 更新から analyze/upsert/export まで 1 job で完結する                                      |
| rollout                | `crawl --refresh` で 1 PR でも detail refresh に失敗したら analyze/upsert/export に進まず、run が未完了で終わる                          |
| downstream contract    | `pull_request_reviewers.requested_at` を読む review bottleneck / workload queries が removed reviewer を数えない                         |
| downstream contract    | `pull_request_reviewers.requested_at` を読む review bottleneck / workload queries が bot / mannequin / author を数えない                 |
| downstream contract    | bot-only reviewer の PR が workload stacks の pending review に表示されないこと（`hasAnyReviewer === false`）                            |
| downstream contract    | analysis/reviews のキュー履歴で bot request の `requestedAt` が除外されること                                                            |
| total_time regression  | `pickupStartedAt` が存在する PR でも `totalTime()` の入力候補に `pickupStartedAt` が含まれないこと                                       |
| total_time regression  | `totalTime()` の引数が `firstCommittedAt`, `pullRequestCreatedAt`, `firstReviewedAt`, `mergedAt`, `releasedAt` の 5 つのみであること     |
| total_time regression  | draft 往復がある PR で `total_time` が draft 期間を含む end-to-end 値のままであること（`pickup_time` とは異なり draft 期間を除外しない） |
| unrelated behavior     | release detection, `review_time`, `deploy_time`, filterPrNumbers の既存挙動が変わらない                                                  |

### 12.3 downstream consumer test

DB 依存の query test として少なくとも次を追加します。現状この周辺で既存 test があるのは `app/routes/$orgSlug/workload/$login/+functions/queries.server.test.ts` のみなので、他は新規作成を前提にします。

- `app/routes/$orgSlug/analysis/reviews/+functions/queries.server.test.ts` を新設し、`getQueueHistoryRawData()` が `requested_at` 非 null の current outstanding reviewer row だけを対象にすることを確認する
- `app/routes/$orgSlug/workload/+functions/stacks.server.test.ts` を新設し、`getPendingReviewAssignments()` が current eligible reviewer snapshot だけを出すこと、および `getOpenPullRequests()` の `hasAnyReviewer` が bot-only reviewer PR で `false` になることを確認する
- `app/routes/$orgSlug/workload/$login/+functions/queries.server.test.ts` は既存ファイルを拡張し、`getBacklogDetails()` の `hasReviewer` / `pendingReviews` が removed reviewer や ineligible reviewer を含めないことを確認する

### 12.4 public contract test

以下は unit test ではなく public contract test として追加します。

- `app/routes/$orgSlug/settings/data-management/+functions/build-export-data.server.test.ts` を新設し、`first_reviewed_at`, `coding_time`, `pickup_time`, reviewer JSON `requested_at` の意味を fixture row で確認する
- `write-parquet.server.ts`: 列追加は不要だが、既存列の値例を更新して semantic drift を防ぐ
- `DATA_DICTIONARY.md`: 実装時は doc update を同 PR に含め、review checklist に「export examples updated」を入れる

### 12.5 cycletime unit test

`batch/bizlogic/cycletime.ts` の pure function も契約変更に合わせて更新します。

- `batch/bizlogic/cycletime_codingTime.test.ts`: 終点が `pullRequestCreatedAt` 固定ではなく `pickupStartedAt` 優先になるケースを追加する
- `batch/bizlogic/cycletime_pickupTime.test.ts`: `pullRequestCreatedAt -> firstReviewedAt` 差分ではなく、state machine が返した `pickupTimeMs` を days 化する contract に置き換える
- `batch/bizlogic/cycletime_totalTime.test.ts`: `totalTime` は変更しないため、既存テストはそのまま維持する。`totalTime()` は渡された引数の min/max を取る pure function であり、「何が渡されないか」は関数単体テストでは検証不可能。`pickupStartedAt` が候補に入らないことの回帰テストはセクション 12.2 のとおり `buildPullRequests` integration test に寄せる

### 12.6 compare / refresh 経路の確認

route test または fetcher contract test で、`app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx` の `compare` と `refresh` が同じ paginated timeline / discussions helper を使うことを確認します。

## 13. 実装メモ

- DB schema 変更は不要。必要なのは raw JSON shape の拡張と解析ロジックの変更
- `pickupStartedAt` は内部計算値として扱い、export 列は増やさない
- `pull_request_reviewers` は historical request log へ拡張しない。current outstanding eligible reviewer snapshot のまま維持する
- rollout の成功条件は「対象 org の zero-failure `crawl --refresh` が完了し、同じ run で analyze/upsert/export まで終わること」
