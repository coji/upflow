# Cycle Time を binding constraint 起点に再フレームする

<!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->

## 背景・課題

Issue #327 で追加された Cycle Time ダッシュボードは、Coding / Pickup / Review の stage time を並列に表示し、Bottleneck Mix でも stage の median または average 構成比をそのまま比較している。Issue #332 は、この構造が「本当に capacity が足りていない binding constraint」と「その結果として遅く見える downstream symptom」の区別を失わせ、読み手を Pickup time など単一 stage の短縮へ誘導するリスクを問題にしている。

#331 は「リンク追加」「Insights 文に矢印を足す」型の表面修正として close されている。本 RDD では、Cycle Time ダッシュボードを症状の順位表ではなく、constraint signal と stage time の因果関係を確認する画面へ再設計する。

この画面が扱う範囲は、PR flow の診断である。全社レベルの bottleneck 解消運用、capacity planning、reviewer ごとの load balancing、リアルタイム alert / notification は本 RDD のスコープ外とする。

## 現状実装の確認

- Cycle Time 画面の route は `app/routes/$orgSlug/analysis/cycle-time/index.tsx` で、breadcrumb label は `Cycle Time` として定義されている (`index.tsx:58-60`)。
- loader は org / timezone / team / PR title filter を取得し、`period`、`metric`、`repository` query を解釈している (`index.tsx:80-130`)。
- raw data は `getOrgCachedData` 経由で `getCycleTimeRawData` を current / previous period 分取得している (`index.tsx:133-157`)。
- `clientLoader` は `computeWeeklyTrend`、`computeKpi`、`computeBottleneckMix`、`computeInsights`、`computeAuthorRows`、`computeLongestPrs` を呼び、表示用データを生成している (`index.tsx:187-235`)。
- 画面本体は KPI、Weekly Trend、Bottleneck Mix、Insights、By Author、Longest PRs を並べている (`index.tsx:403-429`)。
- 現行の説明文は first commit から merge までの cycle time と bottlenecks を扱い、Deploy lag は別扱いとしている (`index.tsx:315-321`)。
- Cycle Time の stage は `coding` / `pickup` / `review` の 3 つに限定され、Deploy は除外されている (`aggregate.ts:7-18`)。
- `computeBottleneckMix` は stage ごとの median / average を合計し、その比率を返している (`aggregate.ts:244-277`)。
- `computeInsights` は比率最大の stage を main driver として文言化し、previous period との差分を付けている (`aggregate.ts:319-393`)。
- `BottleneckMixCard` は `Stage share by {mode} time` として stage 構成比を表示している (`bottleneck-mix-card.tsx:16-74`)。
- `InsightsCard` は `computeInsights` の文字列をそのまま highlight として表示している (`insights-card.tsx:14-41`)。
- `KpiCards` は `Median Total` / `Avg Total`、`PRs`、`Review (median|avg)` の 3 枚を表示している (`kpi-cards.tsx:23-49`)。
- `getCycleTimeRawData` は tenant DB の `pullRequests` から merged PR を対象に `codingTime` / `pickupTime` / `reviewTime` を select し、`mergedAt` で期間を切っている (`queries.server.ts:10-65`)。
- batch 側の cycle time 定義は `codingTime`、`pickupTime`、`reviewTime`、`deployTime`、`totalTime` として実装されている (`batch/bizlogic/cycletime.ts:9-110`)。
- Review Bottleneck 画面は `Review Queue Trend`、`WIP Count vs Review Time`、`PR Size Distribution & Review Time` を表示している (`analysis/reviews/index.tsx:244-248`)。
- Review Bottleneck の loader は queue history、WIP cycle、PR size distribution を同じ cache key で取得している (`analysis/reviews/index.tsx:60-132`)。
- `getQueueHistoryRawData` は `pullRequestReviewers.requestedAt` と review resolution を使い、期間中 open だった reviewer assignment を返している (`analysis/reviews/+functions/queries.server.ts:11-105`)。
- `getWipCycleRawData` は merged PR の `reviewTime`、PR timestamps、size / complexity 情報を返し、WIP 数は client 側で計算するとコメントしている (`analysis/reviews/+functions/queries.server.ts:107-168`)。
- `getPRSizeDistribution` は merged PR の additions / deletions / reviewTime / pickupTime / complexity を返している (`analysis/reviews/+functions/queries.server.ts:170-230`)。
- `computeWipCounts` は author ごとの sweep line で同時 open PR 数を計算している (`analysis/reviews/+functions/aggregate.ts:55-103`)。
- `aggregateWipCycle` は WIP label ごとの median review time と insight を返している (`analysis/reviews/+functions/aggregate.ts:105-146`)。
- `aggregateWeeklyQueueTrend` は日次 queue length から週次 max / median queue を計算し、直近 4 週と前 4 週の比較 insight を返している (`analysis/reviews/+functions/aggregate.ts:166-259`)。
- tenant DB の `pull_requests` には PR timestamp、stage time、PR size / complexity が保存されている (`db/tenant.sql:56-89`)。
- tenant DB の `pull_request_reviews` には reviewer、state、submitted_at が保存され、PR への foreign key がある (`db/tenant.sql:90-103`)。
- tenant DB の `pull_request_reviewers` には reviewer assignment と requested_at が保存されている (`db/tenant.sql:104-112`)。
- shared DB は organizations / members / integrations など org 境界を持つが、PR・review・stage time の実データは tenant DB 側にある (`db/shared.sql:18-29`, `db/shared.sql:76-86`, `db/shared.sql:129-142`)。

## 設計判断

### 結論

Cycle Time ダッシュボードは、stage median の並列比較から、上流の constraint signal と下流の stage time を階層的に pair 表示する constraint vs symptom 診断画面へ移行する。

### 理由

現行の Bottleneck Mix は stage time の構成比を示すだけで、Pickup が遅い原因が reviewer queue / WIP にあるのか、Coding 側の大きな PR にあるのかを分離できない。既存の Review Bottleneck には Queue Trend、WIP × Review Time、PR Size 分布があり、少なくとも review 周辺の constraint signal は tenant DB の raw data から再計算できる。

本ドラフトでは、binding constraint を「対象期間または週次 bucket で、WIP / queue depth / stagnation の上流 signal が悪化し、その下流 stage time の悪化と同じ視覚単位で確認できる制約候補」と暫定定義する。capacity 値が未確定なため、初期表示では断定的な capacity shortage ではなく constraint candidate として扱う。

### 採らなかった代案

- 案 A: #331 型のリンク追加 / Insights 文への矢印追加だけで済ませる。既存の stage median 並列構造が残り、binding constraint と downstream symptom の区別が UI の主構造にならないため採らない。
- 案 B: median / average の精度改善だけを行う。#329 の論点には接続するが、正しい median を出しても「何を改善すべきか」を stage 単体へ誤誘導する問題は残るため採らない。
- 案 C: capacity planning 機能として team capacity を入力・予測する。Issue #332 のスコープ外であり、入力モデルが未確定な状態で診断画面に混ぜると誤判定リスクが増えるため採らない。

## 要件

### 機能

- ユーザーは Bottleneck Mix 相当の領域で、`binding constraint candidate` と `downstream symptom` を別ラベル・別階層で確認できる。
- ユーザーは Insights で「constraint signal が悪化したため、対応する stage time が悪化した」という causal 文構造を読む。
- ユーザーは同じカードまたは同じ視覚単位で、上流 signal と下流 stage time の pair を確認できる。例: Review queue trend と Pickup / Review time を並べる。
- ユーザーは `median Pickup` を単独 KPI として主判断しない。Pickup は constraint signal と pair にするか、旧 view / diagnostic detail に降格する。
- ユーザーはこの画面の目的が「PR flow の制約候補を見つけること」であり、「capacity planning」「reviewer 個別割当」「alerting」をしない画面であることを確認できる。
- 既存の period / team / repository / PR title filter の文脈は新ビューにも残す。

### 非機能

- constraint 判定は既存の 5 分 cache と同程度の粒度で再計算できる範囲に収める。WIP / queue 計算が全 PR・全 reviewer に対して無制限に走る設計は採らない。
- constraint 表示は誤判定リスクを明示する。判定根拠が弱いときは `candidate`、`insufficient signal`、`needs review` など断定しないラベルを使う。
- 既存ユーザーのオンボーディング負荷を下げるため、旧 median view は一定期間 sub-tab または opt-in detail として残す。
- tenant DB の org scoping は既存どおり `getTenantDb(organizationId)` と org middleware に従う。
- 実テナント名・社名・実データ由来の固有名詞を新規 docs / fixture / test に含めない。

## スキーマ変更

スキーマ変更なし。

WIP、queue depth、review stagnation、PR size 分布は、現状の tenant DB にある `pull_requests`、`pull_request_reviews`、`pull_request_reviewers` から再計算できる。capacity 値を手入力する場合だけ新規永続化が必要になるが、本ドラフトの採用候補では capacity 値を必須にしない。したがって `db/shared.sql` / `db/tenant.sql` の変更、destructive 操作、`IF EXISTS` が必要な migration は発生しない想定とする。

## アプリケーション変更

- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:187-235`: `clientLoader` の集計結果を stage median 中心から constraint pair 中心へ変える。
- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:403-429`: KPI / Weekly Trend / Bottleneck Mix / Insights の配置を constraint view へ変更し、旧表示を sub-tab または opt-in detail に降格する。
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.ts:244-277`: Bottleneck Mix の出力を stage share だけでなく constraint candidate / symptom pair を表せる要件に更新する。
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.ts:319-393`: Insights を main driver 文ではなく causal 文として生成する要件に更新する。
- `app/routes/$orgSlug/analysis/cycle-time/+functions/queries.server.ts:10-65`: Cycle Time 側 raw data は引き続き merged PR の stage time を取得する。
- `app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts:11-230`: Queue Trend / WIP × Review Time / PR Size の raw query を Cycle Time 側から利用できる接続点として扱う。
- `app/routes/$orgSlug/analysis/reviews/+functions/aggregate.ts:55-259`: WIP count / queue trend 集計を constraint signal の候補として利用する。
- `app/routes/$orgSlug/analysis/cycle-time/+components/bottleneck-mix-card.tsx:16-74`: stage share card を constraint vs symptom card に置き換える。
- `app/routes/$orgSlug/analysis/cycle-time/+components/insights-card.tsx:14-41`: causal insight 文と根拠 signal を表示できるようにする。
- `app/routes/$orgSlug/analysis/cycle-time/+components/kpi-cards.tsx:23-49`: Review median を単独 KPI として主役にする構造を見直す。
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts:198-231`: 現 Bottleneck Mix の stage ratio test は、新しい constraint pair の test へ置き換える。
- `app/routes/$orgSlug/analysis/reviews/+functions/aggregate.test.ts:82-346`: WIP / queue / PR size 集計の既存 test を回帰確認に使う。

## UI 変更

採用候補は A / B / E の組み合わせとする。

- A: Bottleneck Mix を constraint vs symptom 表示に書き換える。
- B: KPI を再構成し、constraint signal と関連 stage time を pair 表示する。
- E: Insights を causal 文に書き換える。

C の Cumulative Flow Diagram は有力だが、週次 queue / WIP の表示と重複しやすいため Phase 2 候補にする。D の Throughput vs WIP scatter は Little's Law ベースの説明が強く、capacity 定義が未確定な初期導入では後回しにする。

主要画面のドラフト構造:

```text
Cycle Time Constraint Diagnosis
Purpose: identify constraint candidates in PR flow, not assign reviewer work.

+---------------------------------------------------------------+
| Constraint candidate                                           |
| Review capacity pressure                                       |
| Signal: Review queue median ↑ / reviewer WIP high              |
| Symptom: Pickup median ↑ / Review median ↑                     |
| Confidence: candidate, needs human confirmation                 |
+---------------------------------------------------------------+

+-----------------------------+  +-----------------------------+
| Upstream signal             |  | Downstream symptom          |
| Review Queue Trend          |  | Pickup + Review stage time |
| WIP buckets                 |  | Previous-period delta      |
+-----------------------------+  +-----------------------------+

+---------------------------------------------------------------+
| Causal Insights                                                |
| Review queue increased; Pickup time rose in the same period.   |
| Treat Pickup as a downstream symptom until reviewer WIP drops. |
+---------------------------------------------------------------+

+---------------------------------------------------------------+
| Legacy median breakdown (collapsed / opt-in)                   |
| Coding / Pickup / Review stage share                           |
+---------------------------------------------------------------+
```

median 表示は完全廃止しない。SLO 監視や過去 dashboard との比較用途があるため、初期移行では `Legacy median breakdown` として折りたたみまたは sub-tab に降格する。主画面では median Pickup を単独判断材料として見せない。

## 移行方針

ドラフト案では、一気に置換せず、同じ `/:orgSlug/analysis/cycle-time` 内で新 constraint view を主表示にし、旧 median view を sub-tab または collapsed section に降格する。理由は、既存ユーザーが #327 の表示に慣れている可能性があり、比較導線なしで完全置換するとオンボーディング負荷が大きいからである。

Stacked PR に分ける場合の粒度:

1. signal 計算層: Cycle Time 側から Review Bottleneck の queue / WIP / PR size signal を取得・集計できるようにする。
2. 表示層: constraint candidate card、pair 表示、causal Insights を追加する。
3. 旧表示の降格: Bottleneck Mix / median Pickup の単独主表示を collapsed / sub-tab へ移す。
4. copy / onboarding: 画面の目的・限界と warning copy を追加する。

warning copy は「この画面は制約候補を示す。capacity 不足を断定せず、PR / reviewer 文脈と併せて確認する」趣旨にする。

## 受け入れ条件

- [ ] 実装後、Bottleneck Mix 相当の表示で constraint candidate と downstream symptom が別ラベル・別階層で表示される。
- [ ] 実装後、Insights の文が「constraint signal」「その変化」「downstream stage time の変化」を含む causal 文構造になる。
- [ ] 実装後、上流 signal と下流 stage time が同じカードまたは隣接する同一視覚単位で pair 表示される。
- [ ] 実装後、`median Pickup` が主 KPI または単独 Bottleneck Mix の主ラベルとして表示されない。表示する場合は旧 view / detail / warning copy の配下に限定される。
- [ ] `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts` に constraint candidate / symptom pair の代表シナリオが追加され、green になる。
- [ ] `app/routes/$orgSlug/analysis/reviews/+functions/aggregate.test.ts` の WIP / queue / PR size 既存シナリオが green のまま残る。
- [ ] `pnpm validate` が green になる。
- [ ] 新規 docs / fixture / test に実テナント名・社名・実データ由来の固有名詞が含まれない。

## リスク・補足

- 誤った constraint 表示は、Pickup 直接改善と同じく誤誘導になる。初期表示は `binding constraint` と断定せず、`constraint candidate` と根拠 signal を併記する。
- feature flag を使うかは未確定。ドラフト案では同一 route 内の sub-tab / collapsed fallback でロールバック性を確保するが、本番影響が大きい場合は feature flag を検討する。
- WIP / queue 計算は raw assignment と review history に依存する。期間を広げたときの batch / loader / client aggregation の負荷は実データ規模で確認が必要。
- #328 の released_at 正常化とは直接の集計軸が異なる。現 Cycle Time は merge 基準だが、Deploy lag を再統合する場合は #328 の結果を待つ。
- #329 の median 信頼性の論点は残る。median は主判断から降格するが、SLO 監視や過去比較用途として残す場合は定義と信頼性の説明が必要。

## Open Questions (人間レビューで解消すべき論点)

1. constraint の最終定義は WIP / queue / Little's Law / 過去比 / 複合のどれにするか。
2. capacity 値は手入力、推定、または capacity 概念を使わない signal 推移のどれで扱うか。
3. constraint 判定の粒度は週次、期間全体、または両方のどれにするか。
4. 誤った constraint 表示が誤誘導するリスクに対し、どの UX ラベル・warning copy・confidence 表示を使うか。
5. 既存ユーザーの混乱コストに対し、旧 view の残置期間、migration guide、warning copy をどう設計するか。
6. Cycle Time と Review Bottleneck は 1 画面に統合するか、相互参照に留めるか。
7. median は完全廃止するか、SLO 監視用途として opt-in / sub-tab に残すか。
8. Phase 分割は signal 計算層、表示層、旧表示降格、copy の 4 段で十分か。
9. `analysis/reviews` の aggregate 関数を Cycle Time 側から直接 import するか、共有 module に抽出するか。
10. Review queue / WIP signal と Pickup / Review stage time を結びつける期間 alignment は同一週、移動平均、または前後 lag 付き比較のどれにするか。
11. author WIP は現状 author ごとの open PR 数として計算されているが、Issue #332 の reviewer 負荷 signal としては reviewer assignment WIP を別に定義すべきか。
12. PR Size 分布を constraint signal として主表示に入れるか、Review capacity pressure の補助 signal に留めるか。
