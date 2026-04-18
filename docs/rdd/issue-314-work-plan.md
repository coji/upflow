# Issue #314 作業計画

RDD: [`issue-314-pr-popover-resource-route.md`](./issue-314-pr-popover-resource-route.md)

## 方針

- **単一 PR で完結させる**。`PRBlockData` の型変更が `PRPopover` / `PRBlock` / `team-stacks-chart` / `workload/$login` に同時波及するため two-mode で残せない (RDD 移行方針セクション)
- 内部のステップは依存順に並べる。各ステップ完了時に `pnpm validate` を通せるよう、コンパイラを壊さないステップ順序にする
- 影響範囲が UI に集中するため、各ステップで実画面 (Review Stacks / 個人 workload) を手動確認する
- テストは「実装完了後にまとめて」ではなく「該当ステップで追加」する

## 前提

- ブランチ `feat/issue-314-pr-popover-resource-route` で作業 (作成済み)
- main から派生
- RDD と本 work plan の commit を含める

## 実装ステップ

### Step 1: resource route の query 層

**目的**: 単一 PR の enrichment クエリを新設。UI には影響しない add-only な変更。

**新規ファイル**:

- `app/services/pr-popover-queries.server.ts`
  - `getPullRequestForPopover(organizationId: OrganizationId, repositoryId: string, number: number): Promise<PRPopoverData | null>`
  - 内部で 3 並列クエリ (PR 本体 + author lookup / reviewHistory / reviewerRows)
  - `buildPRReviewerStatesMap` で reviewerStates 構築 (再利用: `app/routes/$orgSlug/workload/+functions/aggregate-stacks.ts`)
  - `classifyPRReviewStatus` で reviewStatus 計算 (同上)
  - PR が無いとき `null` を返す
- `app/services/pr-popover-queries.server.test.ts`
  - PR 存在ケース (full enrichment 返却)
  - PR 無しケース (`null` 返却)
  - 異 org の repositoryId を指定したケース (`null` 返却 = tenant 隔離検証)

**型 export**: `PRPopoverData` は `app/routes/$orgSlug/+components/pr-block.tsx` で定義し、本ファイルから import する (Step 2 で型定義を追加するため、Step 1 では一旦 query ファイル内にローカル型を置き、Step 2 で外出しする)

**確認**:

```bash
pnpm vitest run app/services/pr-popover-queries.server.test.ts
pnpm typecheck
```

**満たす受入条件**: 17

---

### Step 2: resource route 本体 + 統合テスト

**目的**: HTTP エンドポイントを公開。Cache-Control 分岐と loader catch を実装。

**新規ファイル**:

- `app/routes/$orgSlug/resources/pr-popover.$repositoryId.$number.ts`
  - GET only。`orgContext` から `organization.id` を server-derived で取得
  - `params.repositoryId` をそのまま、`Number(params.number)` を取る
  - 不正入力 (`!Number.isFinite(number)`): `data({ pr: null, error: 'not_found' }, { headers: { 'Cache-Control': 'no-store' } })`
  - `getPullRequestForPopover` を呼び、戻り値で分岐:
    - `pr !== null`: `data({ pr }, { headers: { 'Cache-Control': 'private, max-age=30' } })`
    - `pr === null`: `data({ pr: null, error: 'not_found' }, { headers: { 'Cache-Control': 'no-store' } })`
  - try/catch で例外を吸収:
    - `Sentry.captureException(e, { extra: { organizationId, repositoryId, number } })` (Sentry import パスは `app/libs/sentry-node.server.ts`)
    - `data({ pr: null, error: 'fetch_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })`
  - **loader 内で throw しない** (要件 6b)
- `app/routes/$orgSlug/resources/pr-popover.$repositoryId.$number.test.ts`
  - 成功 (PR 存在): status 200 / body `{ pr: ... }` / `Cache-Control: private, max-age=30`
  - not_found (PR 無し): status 200 / body `{ pr: null, error: 'not_found' }` / `Cache-Control: no-store`
  - not_found (NaN 入力): 同上
  - fetch_failed (DB 例外をモック発火): status 500 / body `{ pr: null, error: 'fetch_failed' }` / `Cache-Control: no-store` / Sentry に exception 送信
  - tenant 隔離 (異 org の repositoryId): not_found 扱い

**確認**:

```bash
pnpm vitest run app/routes/\$orgSlug/resources/pr-popover.\$repositoryId.\$number.test.ts
pnpm typecheck
curl -i http://localhost:3000/<orgSlug>/resources/pr-popover/<repoId>/<number>  # 手動
```

**満たす受入条件**: 1 (route 公開), 2, 3, 7, 7b, 13, 14, 15, 21, 22

---

### Step 3: PRPopover / PRBlockData 型と useFetcher 化

**目的**: `PRPopover` を resource route 駆動に変更。`PRBlockData` 型を最小化。`PRPopoverData` 型を export し Step 1 のクエリから import に切り替える。

**修正ファイル**: `app/routes/$orgSlug/+components/pr-block.tsx`

- `PRBlockData` 型変更:
  - 必須追加: `repositoryId: string`
  - 削除: `author?` / `authorDisplayName?` / `reviewerStates?`
  - optional に降格: `title?` / `url?`
- `PRPopoverData` 型を新規 export (resource route の戻り値型):
  - `number, repo, title, url, createdAt, complexity, author, authorDisplayName, reviewStatus, reviewerStates`
- `PRPopover` のシグネチャ変更:
  - 旧: `{ pr: PRBlockData, reviewState?, children }`
  - 新: `{ prKey: { repositoryId, number }, reviewState?, fallback?: { title?, url? }, children }`
  - 内部で `useFetcher<{ pr: PRPopoverData | null; error?: 'not_found' | 'fetch_failed' }>({ key: 'pr-popover:${orgSlug}:${prKey.repositoryId}:${prKey.number}' })`
  - `useParams()` から `orgSlug` を取得
  - `Popover.onOpenChange` が `true` で `fetcher.state === 'idle'` のとき `fetcher.load(href('/:orgSlug/resources/pr-popover/:repositoryId/:number', {...}))`
- `PRPopoverContent` 改修 (3 セクション分離 — 要件 5b / UI 変更):
  - ヘッダ行 (現行通り)
  - メタ行 (現行通り)
  - 「現在の PR status」セクション: `pr.reviewStatus`
  - 「この日の review」セクション: `reviewState` がある時のみ
  - 「現在の reviewer states」セクション: `pr.reviewerStates` (見出し必ず付ける)
- `PRPopover` 表示分岐:
  - `fetcher.data?.pr` あり: `<PRPopoverContent pr={fetcher.data.pr} reviewState={reviewState} />`
  - `fetcher.data?.pr` 無く `state === 'loading'`: skeleton (固定高 ~120px)
  - `fetcher.data?.error === 'not_found'`: 「PR が見つかりませんでした」
  - `fetcher.data?.error === 'fetch_failed'` または network error: 「PR の情報を取得できませんでした」+ `fallback` を使った degraded 表示 (PR `repo#number` リンク、title、admin context では `Hide PRs by title…`)
- `PRBlock` 改修:
  - `<PRPopover prKey={{ repositoryId: pr.repositoryId, number: pr.number }} fallback={{ title: pr.title, url: pr.url }}>` を組み立てる

**新規テスト**: `app/routes/$orgSlug/+components/pr-block.test.tsx`

- (a) loading skeleton (data 未定義時)
- (b) `error === 'not_found'` で「PR が見つかりませんでした」
- (c) `error === 'fetch_failed'` で「PR の情報を取得できませんでした」+ fallback の PR リンク
- (d) `reviewState` / `reviewStatus` / `reviewerStates` の 3 つすべて設定で 3 セクションが別ラベルで並置
- (e) `reviewState='APPROVED'` calendar item で開いた popover の `reviewerStates` 内に同閲覧者の `state='CHANGES_REQUESTED'` 行が並んでも矛盾なく表示
- 19 (tenant 切替): org A → org B 切替で `fetcher.data` 再利用なし、新 fetch が走る
- 23 (degraded fallback): `fetch_failed` 時の PR リンク / title / admin メニュー表示

**Step 3 単独では他の利用側 (Step 4, 5) が壊れる**ため、ここで `pnpm validate` は通らない。Step 5 完了まで型エラーが残る前提で進める。

**確認**:

```bash
pnpm vitest run app/routes/\$orgSlug/+components/pr-block.test.tsx
# typecheck は Step 5 完了後にまとめて
```

**満たす受入条件**: 4, 4b, 5, 5b, 6, 6b, 6c, 7, 12, 18, 19, 23

---

### Step 4: aggregate-stacks.ts と team-stacks-chart.tsx

**目的**: Review Stacks 側を新 `PRBlockData` / 新 `PRPopover` に追従。

**修正ファイル**:

- `app/routes/$orgSlug/workload/+functions/aggregate-stacks.ts`
  - `StackPR` 型変更:
    - 追加: `repositoryId: string`
    - 削除: `reviewerStates?`
    - **維持**: `author` / `authorDisplayName` (team-stacks-chart の hover/selection で使用)
    - 維持: `reviewStatus?` (ブロック shape 判定)
  - 内部で `OpenPRRow.repositoryId` / `PendingReviewRow.repositoryId` を `StackPR.repositoryId` に転写
- `app/routes/$orgSlug/workload/+components/team-stacks-chart.tsx`
  - `PRBlockBase` (= `PRBlock`) に渡す `pr` から `author` / `authorDisplayName` / `reviewerStates` を削除し、`repositoryId` を追加 (popover 用フィールドは渡さない)
  - hover/selection callback (`setHovered({ prKey, author: pr.author })` / `setSelected(e, prKey, pr.author)`) は `pr.author` を引き続き参照 — `StackPR.author` を残しているのでそのまま動く
  - `prKey` (DOM marker) はそのまま `${pr.repo}:${pr.number}` 維持

**新規テスト**: `app/routes/$orgSlug/workload/+components/team-stacks-chart.test.tsx`

- 受入条件 20: hover で同 author の row 全体 highlight、selected で対応 row へスクロール

**Step 4 単独でもまだ workload/$login が壊れているので validate は通らない**。

**確認**:

```bash
pnpm vitest run app/routes/\$orgSlug/workload/+components/team-stacks-chart.test.tsx
```

**満たす受入条件**: 1 (Review Stacks 動作), 8, 11, 20

---

### Step 5: workload/$login/index.tsx と queries.server.ts クリーンアップ

**目的**: 個人 workload を新 `PRPopover` に追従。`getPRPopoverEnrichment` を削除。型エラーを完全解消し validate を通す。

**修正ファイル**: `app/routes/$orgSlug/workload/$login/index.tsx`

- loader: 以下を削除
  - `getPRPopoverEnrichment` import と呼び出し
  - `calendarPRDataByKey` 構築 (lines 147-194 相当)
  - `enrichedOpenPRs` / `enrichedPendingReviews` から popover 用 `reviewerStates` を返り値に含める部分 (`reviewStatus` は Backlog ブロック描画に必要なので残す)
  - 返り値から `calendarPRDataByKey` フィールドを削除
- component: 以下を削除/修正
  - `buildCalendarPrData` 関数 (lines 263-280 相当) を削除
  - `CalendarItem` を `prKey: { repositoryId, number }` + `fallback?: { title, url }` を受ける形に変更
  - 各 `<PRBlock pr={{...}}>` の渡しから `author` / `authorDisplayName` / `reviewerStates` を削除し `repositoryId` を追加
  - 各 `<CalendarItem>` の呼び出しを `prKey={{ repositoryId: pr.repositoryId, number: pr.number }}` + `fallback={{ title: pr.title, url: pr.url }}` に変更

**修正ファイル**: `app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`

- `getPRPopoverEnrichment` 関数 (lines 380-500 相当) を削除
- `PRKey` 型を削除
- `getBacklogDetails` は維持 (Backlog の reviewStatus 計算に必要)

**確認**:

```bash
pnpm validate  # ここで全て通るはず
pnpm dev       # 手動確認: Review Stacks / 個人 workload で popover が動く
```

**満たす受入条件**: 1, 2, 4, 5, 9, 10, 12

---

### Step 6: 手動確認 + RDD への Status 追記

**目的**: 受入条件全件を実画面で確認。RDD に実装完了の Status を追記。

**チェックリスト** (RDD 受入条件 1-23 を画面で確認):

- [ ] 1. Review Stacks で PR ブロックをクリック → loading skeleton → enrichment 表示
- [ ] 2. 個人 workload (Authored / Review Queue / カレンダー) でも同じ popover
- [ ] 3. 表示内容が本 issue 適用前と一致 (author / authorDisplayName / reviewerStates)
- [ ] 4. Reviewed カレンダー項目 popover で `reviewState` 表示
- [ ] 5. local 環境で初回 open ~200ms 以下
- [ ] 6. 30 秒以内の再 open で HTTP cache hit (DevTools Network で確認)
- [ ] 7. 削除済み PR の URL に直接アクセス → `{ pr: null, error: 'not_found' }`
- [ ] 7b. not_found レスポンスに `Cache-Control: no-store`
- [ ] 7c. 同一 PR の 2 popover を同時開いて fetcher state 共有確認
- [ ] 7d. `reviewState` / `reviewStatus` / `reviewerStates` の 3 セクションが別表示
- [ ] 7e. fetch_failed で popover 内表示が成立、ページ全体 ErrorBoundary に飛ばない
- [ ] 8-12. コード変更の確認 (grep で旧 import が残っていないか)
- [ ] 13-15. 認可 / tenant 隔離
- [ ] 15b. org 切替後の同一 prKey 再 fetch
- [ ] 16-23. テスト全件パス

**RDD Status 追記**:

```markdown
## Status

Implemented in #<PR番号>
```

`docs/rdd/README.md` の一覧側に「✅ 実装済」マークも検討。

---

## PR description テンプレート

```markdown
## Summary

PR ポップオーバーを resource route 化し、新画面で `<PRPopover prKey={...}>` を貼るだけで動くようにする (RDD: docs/rdd/issue-314-pr-popover-resource-route.md)。

- 新設: `/$orgSlug/resources/pr-popover/$repositoryId/$number` resource route
- `PRPopover` を `useFetcher` 駆動に変更、enrichment は popover open 時に lazy fetch
- `PRBlockData` を最小化、loader 経由の enrichment 配管 (`getPRPopoverEnrichment` / `calendarPRDataByKey`) を削除
- 3 セクション分離 (`reviewState` / `reviewStatus` / `reviewerStates`) で historical / current の境界を明示
- fetch_failed catch 経路で Sentry に例外送信

## Test plan

- [ ] `pnpm validate` 通過
- [ ] 受入条件 1-23 を手動確認 (詳細は work plan)
- [ ] resource route 統合テスト 5 ケース (success / not_found x2 / fetch_failed / tenant 隔離)
- [ ] PRPopover 表示テスト 5 ケース + tenant 切替 + degraded fallback
- [ ] team-stacks-chart hover/selection regression test

## Known accepted risks

- Deploy skew / rollback 中の transport failure → ErrorBoundary バブル可能性 (RDD リスク 1, 緩和策なし)
- 30 秒 cache TTL 中の stale 表示 (許容)
```

## ロールバック

RDD「Rollback 手順」セクション参照。本 issue の rollback は単純 revert。deploy skew / rollback 時の transport failure ErrorBoundary バブルは accepted risk。

## 検証コマンド一覧

```bash
# 全テスト
pnpm validate

# 単一テスト (Step 別)
pnpm vitest run app/services/pr-popover-queries.server.test.ts
pnpm vitest run app/routes/\$orgSlug/resources/pr-popover.\$repositoryId.\$number.test.ts
pnpm vitest run app/routes/\$orgSlug/+components/pr-block.test.tsx
pnpm vitest run app/routes/\$orgSlug/workload/+components/team-stacks-chart.test.tsx

# 手動確認
pnpm dev
# → http://localhost:3000/<orgSlug>/workload (Review Stacks)
# → http://localhost:3000/<orgSlug>/workload/<login> (個人 workload)
```
