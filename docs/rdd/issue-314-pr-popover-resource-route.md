# Issue #314 RDD: PR ポップオーバーを resource route 化して drop-in に使う

## 背景・課題

PR #313 で `PRPopover` を共通コンポーネント化したが、ポップオーバーが必要とする enrichment データ（author / authorDisplayName / reviewerStates / reviewStatus）は呼び出し側の loader が個別に取得している。具体的には:

- [`app/routes/$orgSlug/+components/pr-block.tsx`](../../app/routes/$orgSlug/+components/pr-block.tsx) の `PRPopover` は props で受けた `pr: PRBlockData` に依存
- [`app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`](../../app/routes/$orgSlug/workload/$login/+functions/queries.server.ts) の `getPRPopoverEnrichment(orgId, prKeys)` で複数 PR を一括取得
- [`app/routes/$orgSlug/workload/$login/index.tsx`](../../app/routes/$orgSlug/workload/$login/index.tsx) の loader (lines 147-194) で `calendarPRDataByKey` を構築し、コンポーネントへ流す

結果として、新しい画面で `PRPopover` を使うたびに loader 側に enrichment 取得とマップ構築のコードを増やす必要があり、結合度が高い。Drop-in な再利用が阻害されている。

## 現状実装の確認

### 現状の PRPopover のシグネチャ

[`app/routes/$orgSlug/+components/pr-block.tsx`](../../app/routes/$orgSlug/+components/pr-block.tsx) の `PRPopover` は `pr: PRBlockData` (enrichment 全フィールド事前供給) と viewer 視点の `reviewState?: string` を受け取り、子要素を trigger としてラップする構造。

`PRBlockData` は 9 フィールドで構成され、表示用の基本情報 (number, repo, title, url, createdAt, complexity) に加え、enrichment である author / authorDisplayName / reviewStatus / reviewerStates を optional フィールドとして保持している。

### 呼び出し箇所と loader 依存

呼び出し箇所は 4 ファイル:

- [`app/routes/$orgSlug/+components/pr-block.tsx`](../../app/routes/$orgSlug/+components/pr-block.tsx) `PRBlock` 内 (PR ブロック自身がポップオーバー Trigger)
- [`app/routes/$orgSlug/workload/+components/team-stacks-chart.tsx`](../../app/routes/$orgSlug/workload/+components/team-stacks-chart.tsx) `PRBlockBase` 経由
- [`app/routes/$orgSlug/workload/$login/index.tsx`](../../app/routes/$orgSlug/workload/$login/index.tsx) `CalendarItem` 内 (PRBlock を介さず直接 PRPopover を使う唯一の箇所)
- 上記 3 つで使われる `PRBlockData` には enrichment が含まれている

loader 側で enrichment を構築している主体:

- Review Stacks (`workload/index.tsx`): `getOpenPullRequestReviews` + `getPendingReviewAssignments` を `aggregate-stacks.ts` で集約し `StackPR.author` / `StackPR.authorDisplayName` / `StackPR.reviewerStates` をセット
- 個人 workload (`workload/$login/index.tsx`):
  - Backlog 側: `getBacklogDetails` の reviewerRows / reviewHistory から `enrichedOpenPRs.reviewerStates` を構築 (lines 124-146)
  - **Calendar 側**: `getPRPopoverEnrichment` で created/merged/closed/reviews 全 PR の enrichment を取得し `calendarPRDataByKey` を構築 (lines 147-194)。さらに component 側で `buildCalendarPrData` (lines 263-280) を介して PRPopover に流す

### `getPRPopoverEnrichment` の構造

[`queries.server.ts:380-500`](../../app/routes/$orgSlug/workload/$login/+functions/queries.server.ts) の `getPRPopoverEnrichment(organizationId, prKeys)` は **複数 PR を OR 条件で一括取得** する設計。`prKeys` が空配列のときは early return する分岐を持つ。3 系統 (authors / reviewHistory / reviewerRows) を `Promise.all` で並走する。

呼び出し箇所は `workload/$login/index.tsx` の 1 箇所のみ。

### 既存 resource route のパターン

[`app/routes/$orgSlug/resources/pr-titles-recent.ts`](../../app/routes/$orgSlug/resources/pr-titles-recent.ts) が先行例。

- `middleware = [orgAdminMiddleware]` で route 単位の追加 guard を設定
- loader は query string でパラメータ受け取り
- response は `data({...}, { headers: { 'Cache-Control': 'no-store' } })`

`$orgSlug/_layout.tsx` には `orgMemberMiddleware` が既に適用されているため、`$orgSlug/resources/*` 配下は member 以上で自動的に保護される。

### React Router `useFetcher` の挙動 (実装方針の根拠)

設計判断 3 / 5 / 10 が依拠する `useFetcher` の事実:

- **state 共有**: `useFetcher({ key })` (`packages/react-router/lib/dom/lib.tsx:2892-2978`) は同じ key を指定したインスタンス間で `state.fetchers` map から同じ entry を共有する。`fetcher.data` も `FetchersContext` を通じて共有される (line 2964-2965)。これにより同一 key で複数の PRPopover インスタンスが同じ data を見る
- **abort race**: `router.fetch()` (`packages/react-router/lib/router/router.ts:2388-2394`) は冒頭で `abortFetcher(key)` を呼ぶ。同一 key で 2 回 `fetcher.load()` が走ると前の fetch が abort される。**ただし** `abortFetcher` (`router.ts:3295-3301`) は `controller.abort()` するだけで `fetcher.data` には触らないため、最終的に完了した fetch の結果が data に反映される。1 リクエスト無駄になるが結果整合性は壊れない
- **loader throw → ErrorBoundary バブル**: `handleFetcherLoader` (`router.ts:2907-2911`) は `isErrorResult(result)` のとき `setFetcherError(key, routeId, result.error)` を呼ぶ。`setFetcherError` (`router.ts:3231-3247`) は `findNearestBoundary` 経由で route ErrorBoundary に error を積み、ページレンダリングを置き換える。**逆に言えば、loader が throw せず `data()` で構造化 JSON を返す限り、ErrorBoundary は絶対に発火しない**

これらの事実から、`PRPopover` は `useFetcher` をそのまま使い、loader 側で全エラーを catch して構造化 JSON を返す方針にする (設計判断 5)。

## 設計判断

### 1. resource route 1 本に集約し、loader 経由の enrichment 配管をすべて廃止する

結論: `app/routes/$orgSlug/resources/pr-popover.$repositoryId.$number.ts` を新設し、ポップオーバーが必要とする enrichment は **すべてこの route から fetch する**。各画面の loader が enrichment を準備する経路は削除する。

理由:

- 「新しい画面で `<PRPopover prKey={...}>` を貼るだけで動く」という issue の主目的を達成するには、enrichment 取得を loader から完全に切り離す必要がある
- 中途半端に「loader から渡せたら渡す、無ければ fetch」の two-mode にすると、PRPopover のシグネチャが分岐し利用者が悩む。drop-in を重視して single-mode にする
- loader 経路は今後 throughput / analysis / 単独 PR 詳細などへ展開するたびに毎回コードを増やすので、廃止の判断は早い方がコストが小さい

### 2. PRBlock 自身の表示データと、ポップオーバー fetch データの責務を分割する

結論: `PRBlockData` は **PR ブロック自身の描画に必要な最小フィールド** のみに絞る。ポップオーバーが必要とする付加情報 (author, authorDisplayName, reviewerStates, title, url) は resource route 経由で fetch する。

新しい `PRBlockData` の構成方針:

- ブロックの色 / 形 / アクセシビリティに必要な情報のみ必須にする (number, repo, repositoryId, createdAt, complexity, reviewStatus)
- title / url は CalendarItem の textual display で fallback として使う可能性があるため optional として残す
- author / authorDisplayName / reviewerStates は popover 専用なので削除

resource route の戻り値型 `PRPopoverData` の構成方針:

- popover の表示に必要な全フィールドを保持する (number, repo, title, url, createdAt, complexity, author, authorDisplayName, reviewStatus, reviewerStates)
- enrichment 結果なので author / authorDisplayName / reviewStatus は nullable、reviewerStates は空配列 fallback

理由:

- ブロック表示は SSR 時点で確定している必要があり、popover open 時の遅延 fetch には乗せられない (ブロック自体が空白で出るのは UX として論外)
- 一方 popover の中身は open 時点まで遅延しても支障がない (体感数百 ms)
- title / url は CalendarItem の textual display で既に使われているので、ブロック側の minimum セットに `title?` / `url?` を残しておく余地は持たせる (CalendarItem 用途)

非採用案: ブロックも全部 fetch にする → ブロックリストが空白で見える期間が発生し UX 劣化。

### 3. URL は path params。fetch / state 管理は `useFetcher({ key })` で素直にレールに乗せる

結論:

- resource route のパスは `app/routes/$orgSlug/resources/pr-popover.$repositoryId.$number.ts` (auto-routes のドット記法 with nested dynamic segments)
- `PRPopover` 内では `useFetcher<LoaderData>({ key: 'pr-popover:${orgSlug}:${repositoryId}:${number}' })` を使う。**fetcher key には必ず `orgSlug` を含める**: org 切替後に同じ `repositoryId:number` の popover を開くと、旧 org の `fetcher.data` が再 fetch 完了まで表示される tenant 漏洩リスクがあるため
- popover open 時に `fetcher.load(url)` を呼ぶ。`fetcher.data` がすでにあれば再 fetch (HTTP cache が hit すればすぐ戻る)
- skeleton / error 表示は `fetcher.state` と `fetcher.data` を見て分岐する

理由:

- **state 共有が無料で手に入る**: 同一 PR の別 popover インスタンスが同じ key を指定すれば `fetcher.data` を共有する。Review Stacks で同じ PR が複数列に出ても、片方が load 完了した結果を即座に共有できる
- **abort race は実害なし**: `router.fetch()` は冒頭で `abortFetcher(key)` を呼ぶが、`abortFetcher` は controller を abort するだけで `fetcher.data` には触らない (`router.ts:3295-3301`)。さらに popover は radix の close-on-outside-click により実用上 1 つしか同時に開かない。abort race が発生するのは「同一 PR の 2 つの popover を 100ms 以内に連続 open する」ような稀なケースに限られ、その場合も 1 リクエスト無駄になるだけで最終 state は正しい
- **エラー UI は loader 側で吸収すれば fetcher で完結する** (詳細は設計判断 5)。loader が throw しない限り `setFetcherError` 経路には乗らない
- **drop-in 利用が極めて簡単**: 呼び出し側は `<PRPopover prKey={...}>` を貼るだけ。useEffect / useState / promise cache などの自前配管は一切不要
- path params (canonical URL) は HTTP cache key の正規化と DevTools 観測のために維持
- `repositoryId` は nanoid 由来で URL safe、`number` は整数なので URL escape 問題なし

非採用案:

- manual `fetch` + 自前 promise cache + useEffect/useState → 自前配管が増え、abort race や ErrorBoundary バブルへの過剰防衛になる。実用ケースでは useFetcher で十分
- 共有 key を指定しない (`useFetcher()`) → 同一 PR の別インスタンス間で data 共有されず、Review Stacks のように同じ PR が複数列に出る画面で再 fetch が走る
- bulk enrichment loader を loader 側に残す → 「drop-in」目的に反する
- query string → URL バリエーションが生まれ HTTP cache key の canonical 化コストが増える

### 4. fetch トリガーは「Popover open 時」のみ。hover prefetch は本 issue では実装しない

結論: `Popover` の `onOpenChange` が `true` になったタイミングで `fetchPRPopover(url)` (設計判断 3 の helper) を起動する。trigger の hover (`onMouseEnter`) では fetch しない。

理由:

- Review Stacks は ~170 個の PR ブロックが密集する画面。hover prefetch は短時間に大量のリクエストを誘発する (mouse swipe で全部触れることがある)
- 通常用途では「ホバーして 200ms 待たずに即クリック」のケースは少ない。クリック後 ~100-200ms の skeleton は許容範囲
- 実測で latency 不満が出たら別 issue で hover prefetch (debounce + concurrency 制御つき) を追加検討する

### 5. キャッシュは「正のヒットのみ短期 TTL、負のヒット / エラーは no-store」で分離する

結論:

- **PR が見つかった (`pr !== null`) 場合のみ** `Cache-Control: private, max-age=30` を返す
- **PR が見つからない (`pr === null`) 場合 / 不正入力 / 例外応答** は `Cache-Control: no-store` を返す
- 同一 PR の状態共有は `useFetcher({ key })` で実現する (設計判断 3)。同時 open の物理 dedupe は React Router 標準では保証されないが、abort race による無駄リクエストは最終 state を壊さないため許容
- アプリ側 (server-side) には `getOrgCachedData` のような explicit cache を導入しない

理由:

- 正のヒットを 30 秒 cache する目的は、Review Stacks で同じ PR を連続して確認する用途のレイテンシ短縮。stale tolerance が高い表示データなので 30 秒の遅延は許容
- **負のヒットを cache すると transient failure が sticky failure に変わる**。例えば DB レプリカラグや fetch race 中に最初の open が miss → null が 30 秒キャッシュされる → 直後にデータが揃っても popover を閉じて開き直してもキャッシュ hit して `null` のまま、というシナリオが発生する。retry UI を付けない設計 (判断 10) と組み合わせると、ユーザーは画面リロードしか回復手段がなくなる
- 同様に rollback 時 (route 削除) のレスポンスも `no-store` 系に該当するため、stale client が長時間古い `pr:null` を抱え込むことを防げる
- `private` を付けるのは tenant DB 由来データを CDN / proxy にキャッシュさせないため

実装上の分岐:

- `pr !== null` のとき: `Cache-Control: private, max-age=30`
- `pr === null` (not-found / 別 org / 不正入力) のとき: `Cache-Control: no-store`
- 内部エラー catch のとき: `Cache-Control: no-store` + HTTP 500 (詳細は判断 5b で扱う)

非採用案:

- 全レスポンス一律 `private, max-age=30` → 上記 sticky failure 問題が発生
- 全レスポンス `no-store` → 連続 open でも server hit。安全側だが過剰
- `getOrgCachedData` server cache → cache invalidation の負債を増やす。ポップオーバーは表示用途で stale tolerance が高いので不要
- 404 を返して client に error を投げさせる → 別 org の存在判定漏洩防止 (判断 7) と整合しない

### 6. 認可は layout 継承の `orgMemberMiddleware` のみ。route 単位の追加 guard なし

結論: `app/routes/$orgSlug/_layout.tsx` の `orgMemberMiddleware` がすでに `$orgSlug/resources/*` 配下に適用されているため、resource route 自身に `middleware` は設定しない。

理由:

- ポップオーバーは閲覧画面で表示される情報の subset。member であれば既存画面で全 PR を見られるため、resource route も member 権限で十分
- 既存 [`pr-titles-recent.ts`](../../app/routes/$orgSlug/resources/pr-titles-recent.ts) は admin-only な情報を返すので明示的に `orgAdminMiddleware` を付けているが、本 route はそれに該当しない

guard 詳細:

- `orgContext` から `organization.id` を server-derived で取得 (`params.orgSlug` から URL ハック不可)
- 異 org の `repositoryId` を URL に詰めても `getTenantDb(organization.id)` でしか引かないため、別 org のデータが漏洩することはない (見つからずに `{ pr: null }` が返るだけ)

### 7. 存在しない PR は 404 ではなく `{ pr: null }` で返す

結論: PR が見つからない場合 (削除済み / 別 org / 存在しない番号) は `data({ pr: null }, { status: 200 })` を返し、PRPopover 側で「PR が見つかりません」のメッセージを表示する。

理由:

- 404 を投げると client (`fetchPRPopover`) は `res.ok === false` を error として扱い、popover は「PR の情報を取得できませんでした」(transient failure) と表示することになる。実際には permanent な not-found なので、UX として誤った表現になる
- `{ pr: null }` で正常レスポンスとして返せば、popover 内で「PR が見つかりませんでした」(not-found) と「PR の情報を取得できませんでした」(transient error) を **明確に分離** できる (要件 6)
- セキュリティ上、別 org の存在判定を漏らさないためにも「存在しない」「権限がない」を区別せず常に同じ応答を返す方が安全

### 8. viewer-specific な `reviewState` は引き続き props で渡し、UI 上 PR の current status と明示的に分離する

結論:

- `reviewState` は **「この calendar item がリンクしている特定のレビュー submit イベントの state」** を示す prop として `PRPopover` に渡し続ける。「閲覧者の最新レビュー」ではない
- popover 内では `reviewState` (this calendar entry's review event) と resource route 由来の `reviewStatus` (current PR-level status) を **別々のラベル / 別の視覚要素として並置** する

理由:

- 現行の `getReviewsSubmitted` は閲覧者が submit した review row を **すべて** 返し、`workload/$login/index.tsx` は `repositoryId:number:state:day` で集約する (line 312-345 付近)。つまり同じ PR に対し複数の calendar item (例: 月曜に Approved、水曜に Changes Requested) が並ぶことがある。各 calendar item の popover は **その item が表す review event の state** を表示するのが正しい挙動 (「あなたが最新で submit した state」ではない)
- 各 review event の state は呼び出し側 (calendar item の row) が直接持っているため、prop で渡すのが自然。resource route には載せない
- もし「閲覧者の最新 review state」が UI 要件として必要になったら、別途 resource route 側で `orgContext.user` を見て返す経路を追加できる (本 issue では UI 要件ではないため対象外)
- ただし「PR-level current status (`reviewStatus`)」と「この calendar item の review event (`reviewState`)」を 1 行に並べると `Approved ✓ Changes ✗` のような矛盾文字列が生まれかねないため、UI 上は別セクションで分離する (要件 5b)

UI 表現の指針:

- `reviewState` は「この日の review」セクション (例: `この日の review: ✓ Approved`)
- `reviewStatus` は「現在の PR status」セクション (例: `現在: Changes Requested`)
- `reviewerStates` は「現在の reviewer states」セクション (各 reviewer 行のリスト)
- 3 セクションを並置し、データが無いセクションは省略する
- `reviewState` がある場合、同じ閲覧者の現在状態 (`reviewerStates` 内の自分の行) と異なる可能性があるため、`reviewerStates` 一覧側にも「現在」というセクション見出しを必ず付け、historical な submit と混同させない

### 9. 既存 `getPRPopoverEnrichment` (複数 PR 一括取得) は単一 PR 版に置き換え、置き場所も移す

結論:

- 既存の `getPRPopoverEnrichment` は削除する
- 単一 PR を取得する新規クエリ `getPullRequestForPopover(organizationId, repositoryId, number)` を `app/services/pr-popover-queries.server.ts` に新設する
- resource route の loader は新クエリだけを呼ぶ

理由:

- 複数 PR 一括 (`OR` 条件) のニーズが消えるため、単一 PR の通常 SELECT で書ける。クエリが大幅に簡潔化される
- 配置場所を `workload/$login/+functions/queries.server.ts` から共有 service (`app/services/`) に移すことで、将来 PR 詳細ページ等から再利用しやすくする

### 10. ローディング中は popover 内に skeleton、エラー時は 1 行メッセージ

結論:

- `fetcher.state === 'loading'` かつ `fetcher.data` が未定義のときは固定高 (~120px) の skeleton を表示
- `fetcher.data?.error === 'not_found'` のときは「PR が見つかりませんでした」のテキストを表示
- `fetcher.data?.error === 'fetch_failed'` のときは「PR の情報を取得できませんでした」のテキストを表示
- `fetcher.data?.pr` があれば enrichment 表示
- 再 fetch 中 (`fetcher.data` がすでにあり `state === 'loading'`) は前回の表示を維持し、skeleton にちらつかせない
- リトライ UI は付けない (popover を閉じて再度開けば再 fetch される)

理由:

- skeleton は「中身が来る」予告として一般的な UX
- エラー時のリトライボタンを popover 内に置くのは情報密度的にうるさい。閉じて開き直すのは自然な操作
- 再 fetch 時に skeleton を出すと、既知データが一瞬消えてちらつく。useFetcher の data はリロード中も保持されるのでそのまま見せる

## 要件

### 機能要件

1. `app/routes/$orgSlug/resources/pr-popover.$repositoryId.$number.ts` resource route が、指定された PR の enrichment 情報 (`PRPopoverData`) を JSON で返す。
2. 該当 PR が存在しない / 別 org の場合は `{ pr: null, error: 'not_found' }` を `200 OK` で返す (404 は返さない)。内部エラーの場合は `{ pr: null, error: 'fetch_failed' }` を HTTP 500 で返す。loader は throw しない。
3. レスポンスのキャッシュヘッダは分岐させる:
   - `pr !== null` (success) のとき `Cache-Control: private, max-age=30`
   - `error === 'not_found'` / `error === 'fetch_failed'` / 不正入力のとき `Cache-Control: no-store`
4. `PRPopover` コンポーネントの新シグネチャは `{ prKey: { repositoryId: string; number: number }, reviewState?: string, children: React.ReactNode }` とする。enrichment は popover open 時に resource route から fetch する。旧 `pr: PRBlockData` prop は廃止する (Reviewed カレンダー等は引き続き `reviewState` を渡す — 詳細は要件 5)。
   4b. `PRPopover` 内部は `useFetcher({ key: 'pr-popover:${orgSlug}:${repositoryId}:${number}' })` を使う。**fetcher key に `orgSlug` を含めることで** org 切替後の tenant 漏洩 (旧 org の `fetcher.data` 再表示) を防ぐ。同一 PR の別 popover インスタンスは fetcher state を共有し、片方が load 完了した結果を即座に共有する。連続 open (30 秒以内) はブラウザ HTTP cache が新規ネットワーク往復を防ぐ。
5. `PRPopover` の `reviewState?: string` prop は維持する。`reviewState` は **この calendar item が表すレビュー submit イベントの state** であり、「閲覧者の最新レビュー」ではない (詳細は設計判断 8)。
   5b. popover 内の **3 つの review 関連表示** を明示的にラベル付けして並置し、矛盾表示を避ける:
   - `reviewState` (this calendar entry's review event): 「この日の review」セクション。calendar item が表す特定の submit イベントの state
   - `reviewStatus` (current PR-level status): メタ行右端の outlined Badge (border-current で text 色追従)。resource route 由来の最新 PR-level status
   - `reviewerStates` (current per-reviewer snapshot): 「Reviewers」セクション (border-t で区切り)。各 reviewer の現時点での state。**reviewState と同じ閲覧者の行が並ぶ場合でも、historical (reviewState) と current (reviewerStates 内の自分の行) が異なる可能性があることを UI 上明確にする**
6. fetch 中で `fetcher.data` が無いときは popover 内に skeleton (固定高) を表示する。`error === 'not_found'` と `error === 'fetch_failed'` は **別々のメッセージ** で popover 内に表示する: 前者は「PR が見つかりませんでした」、後者は「PR の情報を取得できませんでした」。
   6b. **「ページ全体のエラー UI に切り替わらない」保証は loader 内例外までに限定される**。loader が catch して構造化 JSON で返す経路は popover-local で完結するが、**transport failure (ネットワーク断 / fetch reject / route discovery 失敗)** は `setFetcherError` 経路に乗りページ全体の ErrorBoundary がバブルする可能性がある。本 issue ではこのケースは緩和しない (deploy skew リスクと同じ許容レベル、リスクセクション参照)。
   6c. **degraded fallback**: loader が構造化 JSON で返す `fetch_failed` (HTTP 500) のときに、`prKey` から組み立てた最低限の情報 (PR `repo#number` リンク、`title` がある場合はタイトル、admin 用 `Hide PRs by title…` メニュー) を popover 内に表示し、ユーザーが PR ページに最短遷移できる導線を残す。これは `PRBlockData` の `title?` / `url?` を fallback 引数として `PRPopover` に渡せるようにすることで実現する (要件 7 に追加)。**transport failure (ネットワーク断 / fetch reject / route discovery 失敗) は対象外** — popover 自体が ErrorBoundary 経路に乗るため popover 内表示は成立しない (要件 6b)。
7. `PRBlock` は `pr: PRBlockData` を受け取り続ける。`PRBlockData` には `repositoryId` を必須で含め、`title` / `url` は optional として残す (block 自体は使わないが、`PRPopover` の degraded fallback 表示で利用するため、呼び出し側が持っているなら渡す)。`PRPopover` は `prKey` に加えて optional な `fallback?: { title?: string; url?: string }` も受け取り、fetch 失敗時の degraded 表示で使う。
8. `aggregate-stacks.ts` の `StackPR` は `repositoryId` を必須で持つ。`reviewerStates` は popover が fetch するので削除する。`reviewStatus` はブロックの shape 判定に必要なので残す。**`author` / `authorDisplayName` は team-stacks-chart の hover 時 row highlighting / selected scroll で参照されているため残す** (popover 表示には使わなくなるが、別目的で必要)。
9. `workload/$login/index.tsx` の loader から `getPRPopoverEnrichment` の呼び出しと `calendarPRDataByKey` 構築 (lines 147-194) を削除する。
10. `workload/$login/index.tsx` のコンポーネントから `buildCalendarPrData` (lines 263-280) を削除し、CalendarItem には `prKey: { repositoryId, number }` を渡す形に変える。
11. `getPRPopoverEnrichment` クエリ ([`queries.server.ts:380-500`](../../app/routes/$orgSlug/workload/$login/+functions/queries.server.ts)) は削除する。新規 `getPullRequestForPopover(organizationId, repositoryId, number)` を `app/services/pr-popover-queries.server.ts` に新設する。
12. `workload/$login/index.tsx` の Backlog セクション (Authored / Review Queue) も同じ `<PRBlock pr={...minimum...} />` シグネチャに揃える。Backlog 側は `reviewStatus` 判定に server-side の reviewer 集計が必要なので、`getBacklogDetails` の呼び出しと reviewStatus 計算は残す。`reviewerStates` を component に渡す経路は削除する (popover 側で fetch される)。

### 非機能要件

1. 認可は `$orgSlug/_layout.tsx` の `orgMemberMiddleware` 継承のみ。resource route 自身に追加 middleware は設定しない。
2. tenant scope は `getTenantDb(organization.id)` で担保する (`organization.id` は `orgContext` 由来 = server-derived)。URL 由来の `repositoryId` で別 org のデータが取れないことを確認する。
3. 同一 PR の状態共有は `useFetcher({ key })` で担保し、再 open (30 秒以内) のレイテンシ短縮はブラウザ HTTP cache (max-age=30) に任せる。explicit な server-side cache は導入しない。
4. ポップオーバー fetch のレイテンシは local 環境で 200ms 以下を目安とする (resource route 1 回の SELECT + 2 回の reviewer 集計、合計 3 並列)。
5. 既存の `pnpm validate` (lint, typecheck, build, test) が通る。

## スキーマ変更

なし (本 issue は read-only な refactor)。

## アプリケーション変更

### 1. 新規ファイル

- `app/services/pr-popover-queries.server.ts`
  - `getPullRequestForPopover(organizationId: OrganizationId, repositoryId: string, number: number): Promise<PRPopoverData | null>`
  - 内部で 3 並列 query (PR 本体 + author lookup / reviewHistory / reviewerRows) を走らせ、`buildPRReviewerStatesMap` で reviewerStates を構築、`classifyPRReviewStatus` で reviewStatus を計算
  - PR が存在しないときは `null`
- `app/routes/$orgSlug/resources/pr-popover.$repositoryId.$number.ts`
  - GET only。loader で `params.repositoryId` / `Number(params.number)` を取る
  - **すべての応答パスで構造化 JSON `{ pr: PRPopoverData | null, error?: 'not_found' | 'fetch_failed' }` を返す**。loader 内で throw しない
  - 不正入力 (NaN, 空文字) は `{ pr: null, error: 'not_found' }` + `Cache-Control: no-store`
  - `getPullRequestForPopover(organization.id, repositoryId, number)` を呼び、戻り値で分岐:
    - PR が見つかった場合: `{ pr }` + `Cache-Control: private, max-age=30`
    - PR が `null` (not-found / 別 org) の場合: `{ pr: null, error: 'not_found' }` + `Cache-Control: no-store`
  - DB / 内部エラーで例外が発生した場合は loader 側で catch し、`{ pr: null, error: 'fetch_failed' }` + HTTP 500 + `Cache-Control: no-store` を返す
  - **loader が throw しないことで** `useFetcher` 利用側の route ErrorBoundary には絶対に飛ばず、popover 内表示で完結する (背景は「現状実装の確認」セクション参照)
  - **catch 経路で必ず Sentry に例外を送信する** (`captureException(e, { extra: { organizationId, repositoryId, number } })`)。silent failure を防ぎ、運用側で regression を検知できるようにする。要件 22 で担保

### 2. 修正ファイル

#### `app/routes/$orgSlug/+components/pr-block.tsx`

- `PRBlockData` から `author?` / `authorDisplayName?` / `reviewerStates?` を削除し、`repositoryId: string` を必須追加。`title` / `url` を optional に降格
- `PRPopoverData` 型を新規 export (resource route の戻り値型)
- `PRPopover` のシグネチャを `{ prKey, reviewState?, children }` に変更
- 内部で `useFetcher<PRPopoverLoaderData>({ key: 'pr-popover:${orgSlug}:${repositoryId}:${number}' })` を使う。**`orgSlug` を key に必ず含める** ことで org 切替時の tenant 漏洩 (旧 org の `fetcher.data` 再表示) を防ぐ (詳細は要件 4b / 受け入れ条件 15b)
- popover の `onOpenChange` が `true` になった時、`fetcher.state === 'idle'` なら `fetcher.load(url)` を呼ぶ
- `orgSlug` は `useParams()` から取得し、`href` ヘルパで resource route の URL を生成 (key の生成にも同じ `orgSlug` を使う)
- popover 内表示は `fetcher.data` / `fetcher.state` を見て分岐: data が無く loading 中なら skeleton、`data.error === 'not_found'` なら「PR が見つかりませんでした」、`data.error === 'fetch_failed'` なら「PR の情報を取得できませんでした」、`data.pr` があれば `PRPopoverContent` を表示
- `PRPopoverContent` は `pr: PRPopoverData` と `reviewState?` を受け取る形に変更
- `PRBlock` が `<PRPopover prKey={{ repositoryId: pr.repositoryId, number: pr.number }}>` を組み立てる

新規 helper / cache file は不要 (useFetcher の state 共有とブラウザ HTTP cache で要件を満たすため)。

#### `app/routes/$orgSlug/workload/+functions/aggregate-stacks.ts`

- `StackPR` から `reviewerStates` を削除し、`repositoryId: string` を必須追加
- `author` / `authorDisplayName` は維持 (team-stacks-chart の hover row highlighting / selected scroll で参照される)
- `reviewStatus` は維持 (ブロックの shape 判定に必要)
- 内部の `OpenPRRow` / `PendingReviewRow` から `repositoryId` を `StackPR` に転写する処理を追加

#### `app/routes/$orgSlug/workload/+components/team-stacks-chart.tsx`

- `PRBlockBase` に渡す `pr` を新しい `PRBlockData` に合わせる (popover 用の author 系フィールドは渡さない、`repositoryId` を追加)
- ただし `pr.author` は team-stacks-chart 自身の hover callback (`setHovered({ prKey, author: pr.author })`) と selected callback (`setSelected(e, prKey, pr.author)`) で参照しているため、`StackPR.author` は維持し、コンポーネント内で `pr.author` を使い続ける
- 既存の `prKey = ${pr.repo}:${pr.number}` (DOM marker 用) はそのまま維持。これは hover dimming 用の DOM key で、popover の prKey とは別物

#### `app/routes/$orgSlug/workload/$login/index.tsx`

- loader: `getPRPopoverEnrichment` import / 呼び出し / `calendarPRDataByKey` 構築 (lines 147-194) を削除。返り値から `calendarPRDataByKey` フィールドを削除
- loader: `enrichedOpenPRs` / `enrichedPendingReviews` から `reviewerStates` を component に渡す部分を削除 (`reviewStatus` は残す)
- component: `buildCalendarPrData` (lines 263-280) を削除
- component: `CalendarItem` を `prKey: { repositoryId, number }` を受ける形に変更
- component: 各 `<PRBlock pr={{...}}>` の渡しから `author` / `authorDisplayName` / `reviewerStates` を削除し `repositoryId` を追加

#### `app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`

- `getPRPopoverEnrichment` (lines 380-500) と `PRKey` 型を削除
- `getBacklogDetails` は残す (Backlog の reviewStatus 計算に必要)。返り値から「popover 専用 column」の取捨選択は不要 (元から reviewStatus 計算に必要な列のみ)

### 3. 既存の設計判断との整合

- CLAUDE.md の「Multi-Tenant Security」原則: `organizationId` は `orgContext` 由来で server-derived、URL 由来の `repositoryId` で別 org への横断は不可
- CLAUDE.md の「Auth guard first」: layout middleware で member guard が完了してから loader が走る
- CLAUDE.md の「Org scoping in queries」: tenant DB のため `getTenantDb(organizationId)` で十分

## UI 変更

- ポップオーバーのレイアウトは現行 `PRPopoverContent` を踏襲しつつ、要件 5b の「3 表示の分離」を満たすため表示領域を以下に再構成する:
  - ヘッダ行: PR ID リンク / SizeBadge (右寄せ・小型化) / `...` actions メニュー (admin) (現行通り)
  - title 行: PR title (GitHub PR への外部リンク化)
  - メタ行: author / 作成からの経過時間 / **`reviewStatus` outlined Badge (右寄せ、border-current で text 色追従)**
  - 「この日の review」セクション: `reviewState` がある calendar item 起動時のみ表示
  - 「Reviewers」セクション (border-t で区切り): `reviewerStates` リスト
- 追加: skeleton (固定高 ~120px、3 行のグレーバー)、「PR が見つかりませんでした」、「PR の情報を取得できませんでした」のエラーメッセージ
- 既存の `PopoverPrimitive.Arrow` 矢印 (PR #313 で追加) はそのまま維持
- popover の `side` は viewport 位置から決定 (`avoidCollisions={false}`)。コンテンツサイズ変化での auto-flip flicker を回避

## 移行方針

スキーマ変更なし。本 issue は単一 PR 内で全変更を完結させる。

### 段階分けはしない理由

- API 切替 (`pr` props → `prKey` props) を two-mode で残すと結合度が下がらないので一括で行う
- 影響範囲は `PRPopover` 利用箇所 4 ファイル + `aggregate-stacks.ts` + queries 1 つに局限される
- 段階リリースのメリット (途中で止められる) より、API 二重化の負債コストの方が大きい

### Rollback 手順

1. PR を revert
2. tenant DB 変更なしのため DB 側の追加対応不要

**既知のリスク (許容)**: ロールバック前にページを開いていた長期 session のクライアント、または rolling deploy 中に「新クライアント + 旧サーバー (route 未配備)」に当たったクライアントは、`fetcher.load(/...pr-popover/...)` で route が見つからず React Router の `setFetcherError` 経路に乗り、最寄り route の ErrorBoundary (実質 root) までバブルしてページが壊れる可能性がある。リスクとして認識するが、本機能の影響範囲 (workload 系画面、popover 利用に限定) と発生条件 (長期 session / 短時間の deploy skew window) を考慮し、本 issue では緩和策を講じない。発生時はユーザーに画面リロードを案内する。

## 受け入れ条件

### 基本動作

1. Review Stacks (`/$orgSlug/workload`) で任意の PR ブロックをクリックすると popover が開き、loading skeleton → enrichment データの順で表示される。
2. `/$orgSlug/workload/$login` の Authored / Review Queue / カレンダー上の PR をクリックしても同じ popover が表示される。
3. popover に表示される author / authorDisplayName / reviewerStates が、本 issue 適用前と一致する。
4. Reviewed カレンダー項目 (`workload/$login`) の popover では、`reviewState` prop 由来のレビュー状態 (例: `✓ Approved`) が表示される。

### 性能と UX

5. ポップオーバー初回 open 時の skeleton 表示時間は local 環境で 200ms 以下。
6. 同じ PR の popover を 30 秒以内に再度開くと、ブラウザ HTTP cache hit (`Cache-Control: private, max-age=30`) により skeleton が即座に enrichment データに置き換わる (ネットワーク往復が観察されない)。
7. 削除済み / 別 org の PR の URL を直接叩いても `{ pr: null, error: 'not_found' }` が `200` で返り、popover は「PR が見つかりませんでした」を表示する。
   7b. `error === 'not_found'` / `error === 'fetch_failed'` のレスポンスは `Cache-Control: no-store` で返され、ブラウザは負のヒットをキャッシュしない。直後にデータが復活した場合、popover を閉じて開き直すと最新値が取得できる。
   7c. Review Stacks で同一 PR が複数列に出る画面では、`useFetcher({ key })` の state 共有により、片方の popover が load 完了した結果を即座にもう片方も参照できる。
   7d. popover 内では `reviewState` (your review) と `reviewStatus` (current status) が別セクションで表示され、両者が異なる場合でも矛盾文字列にならない。
   7e. resource route loader は throw しないため、内部エラー (HTTP 500) が発生してもページ全体の ErrorBoundary は発火せず、popover 内に「PR の情報を取得できませんでした」が表示される。

### コード変更の確認

8. `app/routes/$orgSlug/workload/$login/index.tsx` の loader から `getPRPopoverEnrichment` / `calendarPRDataByKey` の参照が消えている。
9. `app/routes/$orgSlug/workload/$login/index.tsx` の component から `buildCalendarPrData` が消えている。
10. `app/routes/$orgSlug/workload/$login/+functions/queries.server.ts` から `getPRPopoverEnrichment` が消えている。
11. `app/routes/$orgSlug/workload/+functions/aggregate-stacks.ts` の `StackPR` から `reviewerStates` が削除され、`repositoryId` が追加されている。`author` / `authorDisplayName` は team-stacks-chart の hover/selection 用途のため維持されている。
12. `app/routes/$orgSlug/+components/pr-block.tsx` の `PRPopover` シグネチャが `{ prKey, reviewState?, children }` になっている。

### 認可

13. 別 org のメンバーとしてログインし、対象 org の `repositoryId` / `number` を URL に組んだ resource route GET を投げると `orgMemberMiddleware` で redirect される (member ロール無し)。
14. 同 org の member ロールでは popover が正常に表示される。

### マルチテナント隔離

15. 異 org の `repositoryId` を URL に詰めて自 org の resource route を叩いても、`getTenantDb(自 org.id)` でしか引かれないため `{ pr: null, error: 'not_found' }` が返り、別 org のデータが漏洩しない。
    15b. 同じ `repositoryId:number` の PR を **org A で開いた後 org B に切り替えて再度開く** と、`useFetcher` の key が org スコープを含むため org A の `fetcher.data` は表示されず、必ず org B の resource route から fetch し直される。

### validation

16. `pnpm validate` が通る。
17. `getPullRequestForPopover` のユニットテストがある (PR が存在する場合 / null 返却ケース)。
18. `PRPopover` の表示テストがあり、(a) loading skeleton (data 未定義時)、(b) `error === 'not_found'` 時の「PR が見つかりませんでした」、(c) `error === 'fetch_failed'` 時の「PR の情報を取得できませんでした」、(d) `reviewStatus` がメタ行右端の outlined Badge として表示され、`reviewState` がある場合は「この日の review」、`reviewerStates` が 1 件以上ある場合は「Reviewers」セクションが並置されること、(e) `reviewState='APPROVED'` の calendar item で開いた popover の `reviewerStates` 内に同じ閲覧者の `state='CHANGES_REQUESTED'` 行があるとき、両方が別セクションで矛盾なく表示されること、の 5 ケースを検証する。
19. `PRPopover` の tenant 切替テストがあり、org A で `(repositoryId, number)` を fetch した後、URL を org B に切り替えて同じ `(repositoryId, number)` の popover を開いたとき、org A の `fetcher.data` が再表示されず org B 用の fetch が走ることを検証する。
20. `team-stacks-chart` の hover/selection テストがあり、`StackPR.author` を介して同じ author の row 全体が highlight され、selected 時に対応 row へスクロールすることを検証する。
21. resource route (`pr-popover.$repositoryId.$number.ts`) の統合テストがあり、以下の **ステータス / body / Cache-Control ヘッダ** を厳密に検証する:

- 成功 (PR 存在): `200` + `{ pr: PRPopoverData }` + `Cache-Control: private, max-age=30`
- not_found (削除済み / 別 org / NaN 入力): `200` + `{ pr: null, error: 'not_found' }` + `Cache-Control: no-store`
- fetch_failed (DB 例外を強制発火させたケース): `500` + `{ pr: null, error: 'fetch_failed' }` + `Cache-Control: no-store`、かつ loader が throw せず構造化 JSON で返ること

22. fetch_failed catch 経路で **Sentry に例外が送信される** ことを検証する。送信内容には `organizationId` / `repositoryId` / `number` が `extra` として含まれる。silent failure を防ぐ運用要件。
23. degraded fallback テスト: `PRPopover` に `fallback={{ title, url }}` を渡し、loader が構造化 JSON で返す `fetch_failed` のときに、popover 内に PR `repo#number` リンク (url 付き)、title (あれば)、admin context では `Hide PRs by title…` メニューが表示されることを検証する (transport failure は対象外、要件 6c)。

## リスク・補足

1. **N+1 fetch 懸念**: 1 つの画面で popover を連続して開くケース (例: Review Stacks で 5 個の PR を順に確認) では 5 回の resource route 往復が発生する。30 秒 max-age (同一 PR の再 open) と `useFetcher({ key })` (同一 PR の state 共有) で重複は抑えられるが、**異なる PR を順に開く動作は dedupe されない**。これは「ユーザーが目で確認するペース (1〜2 秒/PR)」のレイテンシ要件として許容範囲と判断する。実測で問題が出れば hover prefetch (debounce + concurrency 制御つき) を別 issue で追加検討する。
2. **Backlog の `reviewStatus` 計算**: `getBacklogDetails` は Backlog ブロックの shape 判定 (in-review / approved-awaiting-merge / changes-pending / unassigned) のために reviewer 集計を server side で残す必要がある。これは popover ではなくブロック自身に必要なデータのため、resource route 化対象外。
3. **`reviewState` が popover 内で表示されないケース**: `reviewState` は閲覧者視点の prop で、設定されている場面 (Reviewed カレンダー) でしか表示されない。Review Stacks 等の popover では従来通り表示されない。これは intentional (本 issue 前から同じ挙動)。
4. **HTTP cache の TTL 30 秒の影響**: フィルタを変更した直後 (例: `[DO NOT MERGE]` フィルタを追加) でも、ブラウザにキャッシュされた popover 内容は最大 30 秒間古い状態で表示され得る。ただし popover の中身は title / author 等の rarely-changing データなのでユーザー体感への影響は限定的と判断する。reviewerStates は変動するが、リフレッシュが必要なら popover を閉じて 30 秒以上待つか、画面リロードする運用で許容する。
5. **Drop-in を本当に達成するための条件**: 新画面で `<PRPopover prKey={{ repositoryId, number }}>` を使うには、その画面の loader が `repositoryId` と `number` を持っていれば十分。`PRBlock` 経由ではなく直接 `<PRPopover>` を使う場合 (CalendarItem のような textual trigger) も同じ条件で動く。
6. **`reviewStatus` の整合性**: `reviewStatus` は popover (resource route 由来 = current snapshot, 30 秒 TTL) と Backlog ブロックの shape (loader 由来 = ページ表示時点 snapshot) の 2 経路で計算される。両者が同じ PR について異なる値を出す可能性がある (loader からの初回表示後、別ユーザーがレビューを submit → popover を開くと current が更新されているが、ブロックの shape は古いまま)。これは triage 用途では「ブロック shape は概算、popover が authoritative」という UI 慣習で許容する。受け入れ条件 18 で popover 側の `reviewStatus` 表示が authoritative であることを担保する。
7. **Sticky failure の防止**: 設計判断 5 で `pr === null` を `no-store` にしたことで、transient miss が固定化されるリスクは排除した。残るのは正のヒット中にデータが変化した場合の 30 秒遅延だが、これは表示用途の stale tolerance 範囲内として許容する。
