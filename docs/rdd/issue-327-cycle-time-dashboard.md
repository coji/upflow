# Issue #327 RDD: テナント内 Cycle Time ダッシュボード

## 背景・課題

現在、直近数か月の PR サイクルタイム推移は Upflow からデータをエクスポートし、外部 BI ツールで可視化して共有している。この運用だと、以下の問題がある。

- Upflow を見ているメンバーが同じ場所で傾向を確認できない
- フィルタ、timezone、PR title filter など Upflow 側の表示文脈と外部 BI 側の文脈がずれやすい
- 外部 BI では「次に誰・どの PR を見るべきか」まで Upflow の導線に接続しにくい
- ダッシュボードのサンプルやテストに実データ由来の固有名詞が混ざるリスクがある

本 issue では、テナント内メンバー全員が見られる Analysis 配下の Cycle Time 画面を追加し、直近 3 か月のサイクルタイム推移・ボトルネック・調査対象 author / PR を Upflow 内で確認できるようにする。

## 現状実装の確認

### サイクルタイムの保存先

tenant DB の [`pull_requests`](../../db/tenant.sql) には、サイクルタイム分析に必要な列がすでに存在する。

- `first_committed_at`
- `pull_request_created_at`
- `first_reviewed_at`
- `merged_at`
- `released_at`
- `coding_time`
- `pickup_time`
- `review_time`
- `deploy_time`
- `total_time`
- `repository_id`
- `author`
- `repo`
- `title`
- `url`

`coding_time` / `pickup_time` / `review_time` / `deploy_time` / `total_time` は batch 側で計算済みの値として保存されている。定義は export の data dictionary にも記載されている。

- [`app/routes/$orgSlug/settings/data-management/+data/DATA_DICTIONARY.md`](../../app/routes/$orgSlug/settings/data-management/+data/DATA_DICTIONARY.md)
- [`batch/bizlogic/cycletime.ts`](../../batch/bizlogic/cycletime.ts)

### 既存の analysis 画面

Analysis 配下には以下の先行実装がある。

- [`app/routes/$orgSlug/analysis/reviews/index.tsx`](../../app/routes/$orgSlug/analysis/reviews/index.tsx) — Review Bottleneck
- [`app/routes/$orgSlug/analysis/inventory/index.tsx`](../../app/routes/$orgSlug/analysis/inventory/index.tsx) — Open PR Inventory

どちらも以下のパターンを持つ。

- `loader` で org / timezone / team / PR title filter を取得する
- 重い raw query は [`getOrgCachedData`](../../app/services/cache.server.ts) で 5 分キャッシュする
- `clientLoader` で raw data を集計済み chart data に変換する
- `PageHeader` + `PageHeaderActions` に period selector や filter status を置く
- chart は shadcn/ui `Card` + Recharts + [`ChartContainer`](../../app/components/ui/chart.tsx) を使う

### Throughput 画面のサイクルタイム表示

Throughput 配下の deployed 画面は、単週の deployed PR に対して cycle time metrics を表示している。

- [`app/routes/$orgSlug/throughput/deployed/index.tsx`](../../app/routes/$orgSlug/throughput/deployed/index.tsx)
- [`app/routes/$orgSlug/throughput/deployed/+functions/queries.server.ts`](../../app/routes/$orgSlug/throughput/deployed/+functions/queries.server.ts)
- [`app/routes/$orgSlug/throughput/+components/stat-card.tsx`](../../app/routes/$orgSlug/throughput/+components/stat-card.tsx)

`getDeployedPullRequestReport` は `releasedAt` を基準に期間指定し、`businessDaysOnly` に応じて `diffInDays` で deploy time / total 相当を再計算している。一方、tenant DB 上の `coding_time` 等は batch 計算済みの calendar-day metrics として保存されている。

### PR title filter

PR title filter はすでに tenant DB と query helper に存在する。

- [`db/tenant.sql`](../../db/tenant.sql) — `pr_title_filters`
- [`app/libs/tenant-query.server.ts`](../../app/libs/tenant-query.server.ts) — `excludePrTitleFilters` / `filteredPullRequestCount`
- [`app/libs/pr-title-filter.server.ts`](../../app/libs/pr-title-filter.server.ts)
- [`app/routes/$orgSlug/+components/pr-title-filter-status.tsx`](../../app/routes/$orgSlug/+components/pr-title-filter-status.tsx)

新画面も他の Analysis 画面と同じく、デフォルトでは PR title filter を反映し、`showFiltered` で一時的に除外 PR を表示できるようにする。

### org layout とナビゲーション

org 配下の route は [`app/routes/$orgSlug/_layout.tsx`](../../app/routes/$orgSlug/_layout.tsx) で `orgMemberMiddleware` に保護されている。つまり Analysis 配下に追加する画面は、テナントの member 以上が閲覧できる。

サイドバーのナビゲーションは [`app/components/layout/nav-config.ts`](../../app/components/layout/nav-config.ts) で定義されている。Cycle Time は Analysis group に追加する。

## 設計判断

### 1. route は `/:orgSlug/analysis/cycle-time` とする

結論: 新画面は `app/routes/$orgSlug/analysis/cycle-time/index.tsx` に追加する。breadcrumb label は `Cycle Time`。

理由:

- 画面の主目的は個別 PR の throughput 一覧ではなく、期間傾向とボトルネック分析である
- 既存の Review Bottleneck / Inventory と同じ Analysis 配下に置くと情報設計が自然
- テナント内全員が見られる画面なので settings や admin 配下には置かない

### 2. 初期スコープは merged PR を基準にした 3 か月の週次集計にする

結論: デフォルトでは `merged_at IS NOT NULL` の PR を、組織 timezone 基準の直近 3 か月で集計する。期間判定・週バケット・filterRowsByWeek すべて `merged_at` を基準にする。Cycle time は first commit → merge (= coding + pickup + review)、Deploy stage はこのダッシュボードでは扱わない。

理由:

- `released_at` は `repositories.release_detection_method` 依存の派生値で、monorepo (#328) や release stream の仕様が決まりきっていない現状では精度が出ない (release branch を main に取り込むタイミングで PR がまとめて同一 `released_at` に揃ってしまうアーティファクトが #329 で確認された)
- engineering team がコントロールできる範囲のサイクルタイム (= merge までの時間) を主役にすることで、外部要因 (App Store 審査、deploy schedule の business decision) の揺れを排除できる
- 「PR が完成した」という developer experience の感覚と一致する
- DORA 系の lead-time-to-merge 定義に近い

補足:

- Deploy time は意味のある指標だが、本ダッシュボードではなく **将来の独立 KPI / 独立画面 (Deploy Lag)** として扱う。#328 (release stream) 完了後に再構成する
- open / merged but not released の滞留は本画面では主対象にしない。Open PR Inventory / Review Bottleneck 側で扱う
- 当初の released_at-based 設計から #333 で切り替えた。詳細は issue 参照

### 3. 週次 bucket は組織 timezone の週始まりで作り、ラベルだけ client 側で整形する

結論: raw query は `released_at` と metrics を返し、週 bucket は `clientLoader` の aggregate 関数で組織 timezone に変換して作る。週の開始は既存の `getStartOfWeek` と同じ Monday-start に寄せる。

理由:

- CLAUDE.md の日時原則どおり、DB の日時は UTC ISO として扱い、表示・期間境界は組織 timezone を使う必要がある
- SQLite の date function で timezone 変換を行うと実装が読みづらく、SSR / browser の境界でも扱いがぶれやすい
- 既存 `analysis/reviews` / `inventory` も raw data を取り、aggregate 関数で chart 用構造に変換している

### 4. business days toggle は Phase 1 では表示しない。DB 保存値を正として使う

結論: 初期実装では `coding_time` / `pickup_time` / `review_time` / `deploy_time` / `total_time` の DB 保存値をそのまま使い、business days toggle は実装しない。

理由:

- DB 保存済みの各工程時間は batch 側のサイクルタイム定義と export の正本に揃っている
- `businessDaysOnly` を正しく実装するには、各工程の start/end timestamp をすべて raw query で取得し、`diffInDays` で再計算する必要がある
- `coding_time` / `pickup_time` は fallback 境界を含む batch ロジックに依存するため、UI 側で再計算すると定義ずれのリスクがある
- まず外部 BI 相当の可視化を Upflow に統合することを優先する

非採用案:

- DB 保存値と別に UI 側で business day metrics を再計算する。定義が二重化し、Data Dictionary / export / dashboard の値が一致しなくなる可能性があるため初期実装では採らない。

### 5. Median / Average は切り替え可能にする。初期値は Median

結論: `metric=median|average` の URL query param を持ち、デフォルトは `median` とする。KPI、週次 trend、By Author、Bottleneck Mix は同じ metric mode で計算する。

理由:

- サイクルタイムは長い PR の外れ値に引っ張られやすく、傾向把握には median が安定している
- 外部 BI の運用では average を見たいケースもあるため切り替えは残す
- URL に出すことで共有・再現できる

### 6. repository filter は Phase 1 で実装するが、既存 TeamSwitcher とは独立した URL query にする

結論: `repository=<repositoryId>` query param を追加する。`teamContext` は既存 layout の TeamSwitcher から取得し、repository filter はページ内 `Select` として扱う。

理由:

- Team は org 全体で共有される横断文脈としてすでに layout が扱っている
- Repository はこの画面固有の絞り込みとして、period / metric mode と同じ page-level query に置く方が自然
- `repositories.teamId` と `pullRequests.repositoryId` の両方で where 条件を組める

### 7. cache key には集計条件と `showFiltered` を含める

結論: `getOrgCachedData` の key には少なくとも以下を含める。

- `cycle-time`
- `teamId` or `all`
- `repositoryId` or `all`
- `periodMonths`
- `metricMode`
- `showFiltered` (`sf=t|f`)

`normalizedPatterns` 自体は key に含めない。PR title filter の mutation で `clearOrgCache` される既存方針に従う。

理由:

- `showFiltered` を含めないと、除外あり/なしの結果が cache で混ざる
- pattern 文字列を key に入れると cache key が肥大化する
- 既存 RDD #307 と実装済み helper の方針に合わせる

### 8. 表は「調査対象を選ぶ」ための静かな UI にする

結論: 下部の表は BI 的な全面ヒートマップにはしない。強調は以下に限定する。

- `Main driver` / `Bottleneck` の pill
- `Total` の太字
- `Change` の小さな delta badge
- author ごとの薄い composition bar
- 選択行または drawer 内の mini timeline

理由:

- 画面の主役は週次 trend と Bottleneck Mix。表まで全面的に色付けすると、どこを見るべきか分散する
- Author / PR 表の目的は「次に誰・どの PR を見るべきか」を決めること
- 色は工程カテゴリと状態差分に限定した方が、既存 Upflow の落ち着いた UI に合う

### 9. Insights は初期実装ではルールベースにする

結論: LLM 生成ではなく、集計結果から deterministic な短文を最大 3 件返す。

例:

- `Review dominates cycle time: 45%, +0.6d vs previous period.`
- `Pickup improved to 1.1d, down 15% vs previous period.`
- `Deploy variance is concentrated in one team.`

理由:

- 数値の根拠が明確で、テストしやすい
- 表示のたびに LLM を呼ぶ必要がなく、レスポンス・コスト・再現性の問題がない
- Upflow の分析画面ではまず stable な示唆が重要

### 10. PR 詳細は一覧に詰め込まず、行クリック drawer へ逃がす

結論: `Longest Cycle Time PRs` の一覧列は `PR / Repo / Author / Bottleneck / State / Total / Updated` に絞る。Coding / Pickup / Review / Deploy の細かい内訳は、選択行の mini timeline または drawer 側に表示する。

理由:

- 一覧に工程別日数をすべて並べると、PR タイトルや Bottleneck が読みにくくなる
- 行クリックで既存 PR popover / 将来の PR detail drawer へ接続しやすい
- 画面下部の役割は「上位の問題 PR を見つける」ことであり、詳細分析は drill-down に分ける方が見やすい

## 要件

### 機能要件

1. Analysis ナビゲーションに `Cycle Time` を追加し、`/:orgSlug/analysis/cycle-time` へ遷移できる。
2. org member 以上が画面を閲覧できる。admin-only にはしない。
3. デフォルトで組織 timezone 基準の直近 3 か月、released PR の週次サイクルタイム推移を表示する。
4. Team filter は既存 `teamContext` を反映する。
5. Repository filter で特定 repository に絞り込める。
6. Period は `1 month` / `3 months` / `6 months` / `12 months` を選択でき、デフォルトは `3 months`。
7. Median / Average を切り替えられ、デフォルトは Median。
8. PR title filter が有効な場合は既存画面と同じく除外を反映し、filter status と `showFiltered` を扱える。
9. KPI として `Median/Avg Total`、`PRs`、`Review`、`Deploy` を表示する。
10. KPI には直前同期間との差分を small delta badge で表示する。
11. 週次 chart では Coding / Pickup / Review / Deploy の内訳と Total の推移を確認できる。
12. chart tooltip では week、PR count、Total、Coding、Pickup、Review、Deploy を表示する。
13. Bottleneck Mix では選択期間の Coding / Pickup / Review / Deploy の構成比を表示する。
14. Insights は最大 3 件の deterministic な短文を表示する。
15. By Author では `Author / PRs / Median or Avg Total / Main driver / Review p75 / Change vs previous period` を表示する。
16. By Author には工程構成を薄い composition bar で表示する。全面ヒートマップにはしない。
17. Longest Cycle Time PRs では `PR / Repo / Author / Bottleneck / State / Total / Updated` を表示する。
18. PR row は clickable にし、詳細 drawer または PR popover への導線を持つ。
19. サンプルデータ、テスト名、ドキュメントには実テナント名・社名・実データ由来の固有名詞を含めない。

### 非機能要件

1. 日付境界と週 bucket は組織 timezone を使う。DB から読んだ日時は UTC ISO として扱う。
2. tenant DB の scoping は `getTenantDb(organizationId)` と org middleware に従う。
3. 重い raw query は `getOrgCachedData` で 5 分程度 cache する。
4. cache key には `teamId` / `repositoryId` / `period` / `metricMode` / `showFiltered` を含める。
5. UI は既存 shadcn/ui + Recharts の画面と揃える。カードの多用・ネスト・過度な色面は避ける。
6. 表の色は chart と同じ工程色を薄く使い、alert 的な赤を多用しない。
7. 集計関数は unit test 可能な pure function に分ける。
8. raw query は必要列だけ select し、アプリ側で全期間・全 PR を無制限に持たない。

## スキーマ変更

なし。

既存 `pull_requests` の cycle time columns と `repositories.team_id` を使用する。新しい正規化テーブルや snapshot table は作らない。

将来、サイクルタイムの pre-aggregation が必要になるほど PR 件数が増えた場合は、週次 aggregate table を別 issue で検討する。

## アプリケーション変更

### 想定する実装単位

route は `app/routes/$orgSlug/analysis/cycle-time/` 配下に追加する想定。具体的なファイル分割は実装時に調整してよいが、少なくとも以下の責務は分ける。

- route loader / clientLoader
- tenant DB query
- raw rows から chart / table data へ変換する aggregate 関数
- chart / table / insight の表示 component
- aggregate 関数の unit test

### 更新する既存箇所

- [`app/components/layout/nav-config.ts`](../../app/components/layout/nav-config.ts) — Analysis group に Cycle Time を追加する
- 必要なら [`app/routes/$orgSlug/analysis/_layout.tsx`](../../app/routes/$orgSlug/analysis/_layout.tsx) — breadcrumb の親 link は既存のままでよい

### Query 方針

サイクルタイム画面用の raw query は、chart / author table / PR table を組み立てるのに必要な最小限の列だけを返す。

- `repositoryId`
- `repo`
- `number`
- `title`
- `url`
- `author`
- `authorDisplayName`
- `state`
- `pullRequestCreatedAt`
- `mergedAt`
- `releasedAt`
- `codingTime`
- `pickupTime`
- `reviewTime`
- `deployTime`
- `totalTime`

主な where 条件:

- `pullRequests.releasedAt is not null`
- `pullRequests.totalTime is not null`
- `pullRequests.releasedAt >= sinceDate`
- previous period 用には `prevSinceDate <= releasedAt < sinceDate`
- team filter がある場合は `repositories.teamId = teamId`
- repository filter がある場合は `pullRequests.repositoryId = repositoryId`
- `excludeBots`
- `excludePrTitleFilters(normalizedPatterns)`

PR title filter status 用の count は、画面と同じ母集団で算出する。

### Aggregate 方針

aggregate 関数は raw rows から画面表示用の派生データを作る。

- KPI
- previous period diff
- weekly trend points
- bottleneck mix
- insights
- author rows
- longest PR rows

`Main driver` / `Bottleneck` は `codingTime` / `pickupTime` / `reviewTime` / `deployTime` のうち最大の工程とする。`null` は 0 として扱うのではなく、その工程を対象外にする。全工程が `null` の場合は `Unknown`。

構成比は、選択 metric mode に応じて工程ごとの median / average を計算し、その合計に対する割合を出す。`totalTime` と工程合計は完全一致しない可能性があるため、Bottleneck Mix は「工程内訳の構成比」として扱う。

## UI 変更

### Page Header

- Title: `Cycle Time`
- Description: `3-month trend of PR delivery speed and bottlenecks.`
- Actions: PR title filter status、repository select、period select、Median / Average segmented control

Business days toggle は Phase 1 では置かない。

### KPI

4 card を横並びにする。

- `Median Total` or `Avg Total`
- `PRs`
- `Review`
- `Deploy`

差分 badge は以下の意味にする。

- time metric は減少が good、増加が bad
- PRs は増減だけ表示し、good/bad 判定を強く出さない

### Weekly Cycle Time Trend

`Card` 内に chart を置く。

- stacked bar: Coding / Pickup / Review / Deploy
- line: Total
- tooltip: week + PR count + each metric

annotation は任意。入れる場合は deterministic に 1 件までにし、例として previous 4 weeks 比で Review が最も増えた週を示す。

### Bottleneck Mix / Insights

右 column または chart 下に配置する。画面幅が狭い場合は縦積みにする。

Insights は短文 3 件まで。長文説明や in-app manual にはしない。

### By Author

列:

- Author
- PRs
- Composition
- Median/Avg Total
- Main driver
- Review p75
- Change vs prev period

UI:

- composition は薄い 4-segment bar
- Main driver は small pill
- Total は bold
- Change は compact delta badge
- row 全体や metric cell を heatmap で塗らない

### Longest Cycle Time PRs

列:

- PR
- Repo
- Author
- Bottleneck
- State
- Total
- Updated

UI:

- PR title は link style
- State は neutral badge
- Bottleneck は small pill
- Total は bold
- 行末に chevron を置き、詳細導線を示す

詳細 drawer を実装する場合は、一覧の列を増やすのではなく、工程別内訳と PR への導線を drawer 側に置く。

## テスト方針

### Unit tests

aggregate 関数の unit test で以下を確認する。

- timezone を考慮した週 bucket が期待どおりになる
- median / average mode で KPI と weekly trend が変わる
- previous period diff が正しく計算される
- Bottleneck は最大工程を選ぶ
- null metrics がある PR でも集計が壊れない
- By Author の Review p75 と Change が正しく出る
- Longest PRs が total time desc で並ぶ
- Insights が最大 3 件に制限される

### Route/query tests

必要に応じて server query のテストを追加する。

- team filter
- repository filter
- PR title filter
- showFiltered
- previous period

既存 test setup の負荷が大きい場合、Phase 1 では aggregate unit test を優先する。

### Visual / manual QA

- seed data または匿名の fixture で画面を確認する
- テーブルが過度なヒートマップになっていないこと
- 実テナント名・社名が fixture / screenshot / docs に含まれないこと
- 画面幅を狭めても header actions と tables が破綻しないこと

## 移行方針

スキーマ変更はないため migration は不要。

外部 BI 運用はすぐに削除しない。Upflow 画面の数値と外部 BI の数値を比較し、定義差分がないことを確認してから段階的に置き換える。

## リスク・補足

### business day 指標の期待差分

外部 BI 側で営業日ベースの計算をしている場合、DB 保存済み metrics と値が一致しない可能性がある。現時点でこの RDD は DB 保存値を正として扱う。business day 対応が必要なら、batch 側の正本定義から拡張する別 issue にする。

### release 検出の遅れ

`released_at` が後から補完される PR は、補完後に過去週の数字へ反映される。これは既存 throughput/deployed と同じ性質であり、5 分 cache の範囲で許容する。

### author 表の個人評価化リスク

By Author は人を責めるためではなく、ボトルネック調査対象を探すための表である。UI コピーは個人評価に見えすぎないようにし、Main driver / PR count / trend の文脈を添える。

### PR 件数が多い tenant

直近 12 か月でも released PR が多い tenant では raw rows が増える。初期実装では必要列のみ select + org cache で対応する。遅い場合は SQL 側 pre-aggregation または materialized weekly aggregate を検討する。

## 受け入れ条件

1. `/:orgSlug/analysis/cycle-time` にアクセスすると Cycle Time 画面が表示される。
2. Sidebar の Analysis group から Cycle Time へ遷移できる。
3. デフォルトで直近 3 か月の released PR の週次サイクルタイム trend が表示される。
4. Team / Repository / Period / Median-Average / PR title filter の条件変更が chart と tables に反映される。
5. KPI に Total / PRs / Review / Deploy と前期間差分が表示される。
6. Weekly chart の tooltip で週ごとの PR count と工程別 metrics を確認できる。
7. Bottleneck Mix と Insights から主要なボトルネックを把握できる。
8. By Author は全面ヒートマップではなく、composition bar / driver pill / delta badge で静かに表示される。
9. Longest Cycle Time PRs は長期化 PR と主因を scan でき、詳細導線を持つ。
10. 実テナント名・社名・実データ由来の固有名詞が追加コード、テスト、ドキュメントに含まれていない。

## Status

Phase 1 implemented.

- route: `app/routes/$orgSlug/analysis/cycle-time/index.tsx`
- nav: `app/components/layout/nav-config.ts` の Analysis group に `Cycle Time` を追加
- raw query: `+functions/queries.server.ts`
- aggregate: `+functions/aggregate.ts` (unit test 同居)
- UI: `+components/` (KPI, Weekly Trend, Bottleneck Mix, Insights, By Author, Longest PRs)
- 週 bucket: `mergedAt` を組織 timezone で Monday-start に変換し、`untilDate` は exclusive として扱う (#333 で `releasedAt` 基準から切り替え)
- 母集団: `mergedAt is not null` の PR (released か否かを問わない)
- 工程: Coding / Pickup / Review の 3 stage。Deploy は本ダッシュボードでは扱わない (#333)
- KPI: Median/Avg Total / PRs / Review の 3 枚
- previous period: 同じ長さの直前期間 (`prevSinceDate = calcSinceDate(periodMonths * 2, timezone)`, `prevUntilDate = sinceDate`)
- repository filter: team filter で絞り込んだ repositories list を `Select` で表示し、URL `?repository=<id>` に保存
- business days toggle / drawer / 詳細 mini timeline は Phase 1 では未実装。GitHub の PR ページへのリンクと chevron で代用
- follow-ups: #328 (monorepo release stream) / #330 (chart keyboard a11y) / #332 (constraint reframe)
