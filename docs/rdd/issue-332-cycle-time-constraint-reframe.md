# Cycle Time を「上位の遅い PR の診断」起点に再フレームする

<!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->

## 背景・課題

Issue #327 で追加された Cycle Time ダッシュボードは、Coding / Pickup / Review の stage time を **中央値中心** に並列表示し、Bottleneck Mix も stage の median または average の構成比をそのまま比較する構造になっている。Issue #332 はこの構造が **「本当に詰まっているのはどこか」を見せられていない** ことを問題提起している。

実テナントの計測で次が確認できた (詳細は内部調査参照):

- Pickup / Review の **中央値は数十分から数時間** に収まる (= 半数以上の PR は瞬殺マージ)
- 一方 **上位 10% は数日、上位 1% は週単位** で停滞する
- `cycle time の合計待ち時間` の **大半は上位の遅い側 PR が作っている** (上位 10% が全体の大半を占める)
- 中央値を改善しても合計待ち時間はほぼ変わらない (改善余地は遅い側に偏在)

つまり中央値中心の現行表示は、**ボトルネックの所在を逆方向に誤誘導している**。改善すべきは中央値ではなく「**遅い側の PR が何で詰まっているか**」を診断すること。

加えて 2026 年の業界動向 ([../practices/metrics/ai-productivity-paradox.md](../practices/metrics/ai-productivity-paradox.md)) でも、AI コーディング普及で PR サイズ +51.3%、レビューなしマージ +31%、レビュー中央値 +441% の悪化が報告されており、本問題は upflow 固有ではなく業界全体の構造問題。

#331 は「リンク追加」「Insights 文に矢印を足す」型の表面修正として close されている。本 RDD では、Cycle Time ダッシュボードを **遅い側 PR の特徴別診断画面** へ再設計する。

スコープ: PR flow の診断のみ。capacity planning、reviewer 個別割当、リアルタイム alert / notification は本 RDD 対象外。

## 現状実装の確認

- Cycle Time 画面の route は `app/routes/$orgSlug/analysis/cycle-time/index.tsx` で、breadcrumb label は `Cycle Time` (`index.tsx:58-60`)
- loader は org / timezone / team / PR title filter を取得し、`period`、`metric`、`repository` query を解釈 (`index.tsx:80-130`)
- raw data は `getOrgCachedData` 経由で `getCycleTimeRawData` を current / previous period 分取得 (`index.tsx:133-157`)
- `clientLoader` は `computeWeeklyTrend`、`computeKpi`、`computeBottleneckMix`、`computeInsights`、`computeAuthorRows`、`computeLongestPrs` を呼ぶ (`index.tsx:187-235`)
- 画面本体は KPI / Weekly Trend / Bottleneck Mix / Insights / By Author / Longest PRs を並列表示 (`index.tsx:403-429`)
- Cycle Time の stage は `coding` / `pickup` / `review` の 3 つに限定、Deploy は除外 (`aggregate.ts:7-18`)
- `computeBottleneckMix` は stage ごとの median / average を合計して比率を返す (`aggregate.ts:244-277`)
- `computeInsights` は比率最大の stage を main driver として文言化 (`aggregate.ts:319-393`)
- `KpiCards` は `Median Total` / `Avg Total`、`PRs`、`Review (median|avg)` の 3 枚を表示 (`kpi-cards.tsx:23-49`)
- `BottleneckMixCard` は `Stage share by {mode} time` として stage 構成比を表示 (`bottleneck-mix-card.tsx:16-74`)
- `getCycleTimeRawData` は tenant DB の `pullRequests` から merged PR を対象に `codingTime` / `pickupTime` / `reviewTime` を select、`mergedAt` で期間を切る (`queries.server.ts:10-65`)
- batch 側の cycle time 定義は `codingTime`、`pickupTime`、`reviewTime`、`deployTime`、`totalTime` (`batch/bizlogic/cycletime.ts:9-110`)
- `Longest PRs` 表示は既に存在し、上位の遅い PR を一覧化している (`index.tsx` の該当セクション、`computeLongestPrs`)
- Review Bottleneck 画面 (別 route) は `Review Queue Trend`、`WIP Count vs Review Time`、`PR Size Distribution & Review Time` を表示 (`analysis/reviews/index.tsx:244-248`)
- `getPRSizeDistribution` は merged PR の additions / deletions / reviewTime / pickupTime / complexity を返す (`analysis/reviews/+functions/queries.server.ts:170-230`)
- tenant DB の `pull_requests` には PR timestamp、stage time、PR size / complexity、author、`pull_request_reviews` には reviewer / state / submitted_at を保存 (`db/tenant.sql:56-103`)
- shared DB は org 境界、PR データは tenant DB 側 (`db/shared.sql:18-29`)

## 設計判断

### 結論

Cycle Time ダッシュボードを **「中央値中心の stage 並列表示」から「上位の遅い PR の特徴別診断」へ移行** する。具体的には:

1. **主表示は「上位 N% の遅い PR」とその特徴 (PR size、作成曜日、月、author 分布、bot/no-review 区分)**
2. **bot PR と「レビューなしマージ PR」を query 層でフィルタ可能にする** (生中央値が機能不全になる主因の除去)
3. 中央値・stage 構成比は **「過去比較・SLO 監視用の補助表示」** として残置 (削除しない)
4. 業界文脈 (DORA 2025 AI productivity paradox) を画面に明示し、「中央値で速く見えても遅い側に問題が偏在する」現象を読み手に説明

### 理由

- **データ起点**: 実テナント計測で「中央値は速い、上位 10% に問題が偏在、合計待ち時間の大半は遅い側」が確認済 (具体値は内部調査参照)。中央値構成比の Bottleneck Mix は、データ的に意味のある順位を出せていない
- **業界整合**: DORA 2025 で同じパターン (PR サイズ +51.3%、レビューなしマージ +31%) が業界規模で確認されており、AI 時代に強化される問題。upflow は「検出側の dashboard」としてこの現象を可視化する位置にある ([../practices/metrics/ai-productivity-paradox.md](../practices/metrics/ai-productivity-paradox.md))
- **因子の単純化**: 実データで因子の効き目を見ると **PR size が最強** (XS と XL で遅延発生率に数倍差)、次に **作成曜日** (金曜投入は週末越えで体感的に遅い)、次に **月単位ばらつき**。一方、reviewer 指名はそもそも大半の PR で行われていないため reviewer queue / WIP は signal として弱い。この発見は元 RDD の「constraint signal = reviewer queue 主」という仮説を否定する
- **既存資産の活用**: Longest PRs 表示は既に存在 (`computeLongestPrs`)。これを主表示化し、特徴別の集計 (size 分布、曜日、月) を周辺に配置すれば、新規実装は最小化できる
- **Pair 表示は副次扱い**: 元 RDD の「上流 signal × 下流 stage time pair」は、主信号が PR size であれば「PR size 別の stage time 分布」という単一カードに統合できる。階層 pair UI は不要

### 採らなかった代案

- **案 A: 元 RDD のまま「constraint signal vs symptom pair 表示」を主軸にする** — 実データで reviewer queue / WIP が主因でないことが分かったため、pair 表示の主軸が空転する。採用しない
- **案 B: 中央値の精度改善 (issue #329 系) のみ行う** — 中央値が正確になっても「中央値で診断する」前提自体が誤っているため、根本問題は解消しない。採用しない
- **案 C: capacity planning 機能を追加** — Issue #332 のスコープ外。capacity 値の入力モデルが未確定で、診断画面に混ぜると誤判定リスクが増える。採用しない
- **案 D: Bottleneck Mix を完全削除して全部 Longest PRs に集約** — 中央値・stage 構成比は SLO 監視や過去 dashboard との比較で正当な用途がある。完全削除はオンボーディング負荷を上げる。補助表示として残置する案を採用

## 要件

### 機能

- ユーザーは画面を開いたとき、**主表示として「上位の遅い PR とその特徴」** を見る (中央値や stage 構成比ではなく)
- ユーザーは PR を **PR size、作成曜日、月、author、bot/no-review 区分** で特徴別にグルーピングして遅延発生率を確認できる
- ユーザーは **bot PR とレビューなしマージ PR をフィルタで除外/分離** して数値を見られる (デフォルトは除外)
- ユーザーは Insights で「上位の遅い PR は X (例: 大きい PR / 金曜投入 / 特定 author) に偏っている」という具体的な特徴を読む
- ユーザーは **中央値と stage 構成比を補助表示として参照** できる (主画面の下部 or sub-tab)
- ユーザーは画面の説明で「中央値が良くても遅い側に問題が偏在することがある」を理解できる (DORA 2025 文脈の onboarding copy)
- 既存の period / team / repository / PR title filter は新ビューでも維持

### 非機能

- 集計は既存の 5 分 cache 範囲で再計算可能なコストに収める。bot / レビューなし区分は `pull_requests.author` と `pull_request_reviews` の単純集計で実現可能
- フィルタ既定値の変更による既存ユーザー混乱を抑える (デフォルトで bot 除外なら、トグル UI で「全 PR を含む」に戻せること)
- tenant DB の org scoping は既存どおり `getTenantDb(organizationId)` と org middleware に従う
- 実テナント名・社名・実データ由来の固有数値を新規 docs / fixture / test に含めない (NDA 配慮、`docs/agent-rules/confidentiality.md` 参照)

## スキーマ変更

スキーマ変更なし。

PR size、作成曜日、月、author、bot/no-review 区分はすべて現状の tenant DB (`pull_requests` の additions / deletions / pull_request_created_at / author、`pull_request_reviews` の有無) から計算可能。bot 判定は author 名のパターンマッチ (Renovate / dependabot[bot] / github-actions[bot] 等) で実装、後で `bot_authors` のような小規模テーブルに切り出す余地はあるが本 PR スコープ外。

## アプリケーション変更

- `app/routes/$orgSlug/analysis/cycle-time/+functions/queries.server.ts:10-65` — bot / レビューなしマージの区分情報を返すよう raw query を拡張 (`pull_request_reviews` を JOIN、author パターンマッチ)
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.ts:7-393` — 集計関数を「中央値中心」から「上位 N% の遅い PR + 特徴別分布」中心に再構成
  - `computeKpi` — 中央値 KPI を補助化、主 KPI を「上位 10% の遅い PR の件数 / 合計待ち時間」に
  - `computeBottleneckMix` — stage 構成比を「補助表示」用に維持、主表示用に「PR size 別 / 曜日別 / 月別の遅延発生率」関数を追加
  - `computeInsights` — main driver 文ではなく「遅い PR の特徴」を要約する文構造に
- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:187-235` — `clientLoader` の集計呼び出しを上記再構成に合わせる
- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:403-429` — レイアウトを「主: 上位の遅い PR + 特徴別分布、補助: 中央値 / stage 構成比」に並べ替え
- `app/routes/$orgSlug/analysis/cycle-time/+components/bottleneck-mix-card.tsx:16-74` — stage share カードを「PR size 別の遅延発生率」型に置き換え (元の stage share 表示は補助表示用に残す)
- `app/routes/$orgSlug/analysis/cycle-time/+components/insights-card.tsx:14-41` — Insight 文を「遅い PR の特徴」を述べる構造に
- `app/routes/$orgSlug/analysis/cycle-time/+components/kpi-cards.tsx:23-49` — 主 KPI を「上位の遅い PR」関連に変更、中央値系 KPI は補助エリアへ
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts:198-231` — 上位の遅い PR + 特徴別の代表シナリオに置き換え

## UI 変更

主要画面のドラフト構造:

```text
Cycle Time Diagnosis
Purpose: identify slow PRs and what causes them.
Note: Median can look fast even when slow PRs dominate total wait time.
Industry context: DORA 2025 reports +441% review time, +51.3% PR size in AI era.

Filter: [✓ exclude bot] [✓ exclude no-review merges] [reset]

+---------------------------------------------------------------+
| Top KPI                                                       |
| Slow PR count (top 10%): N | Wait time share: X% of total     |
+---------------------------------------------------------------+

+-----------------------------+  +-----------------------------+
| Slow PRs by characteristic  |  | Longest PRs (top 20)        |
| - PR size buckets (XS-XL)   |  | - sorted by total time      |
|   slow rate per bucket      |  | - shows author / size /     |
| - Day of week (Mon-Sun)     |  |   created date              |
| - Month                     |  |                             |
| - Author distribution       |  |                             |
+-----------------------------+  +-----------------------------+

+---------------------------------------------------------------+
| Insights                                                      |
| Slow PRs concentrate in: large size (XL), Friday creation,   |
| and specific months. Median Pickup is fast (under 1h) but    |
| top 10% take over 4 days.                                    |
+---------------------------------------------------------------+

+---------------------------------------------------------------+
| (Auxiliary) Median view & stage share                         |
| Coding / Pickup / Review median, stage share for SLO/history |
+---------------------------------------------------------------+
```

中央値表示は完全廃止しない。SLO 監視や過去 dashboard との比較用途を補助エリアで維持。**主画面では中央値を主判断材料として見せない**。

## 移行方針

新主画面と旧表示を **同一 route 内で構造的に分離** する (主表示と補助表示)。理由は:

- 既存ユーザーが #327 表示に慣れている可能性があり、route 完全置換はオンボーディング負荷大
- 「主と補助」を明示することで、新画面の意図 (中央値ではなく遅い PR を見ろ) を読み取りやすくする
- ロールバックは「主と補助の入れ替え」で対応可能

Stacked PR 分割案:

1. **query 層**: bot / レビューなしマージ区分を返すよう raw query 拡張
2. **集計層**: 上位 N% / 特徴別 (size / 曜日 / 月) の集計関数追加
3. **表示層**: 主 KPI / 特徴別カード / Insight の新構造を実装、旧 Bottleneck Mix を補助エリアへ降格
4. **copy / onboarding**: 画面説明、DORA 2025 文脈、中央値の限界に関する説明文を追加

各 PR のサイズは [../practices/pr-flow/pr-size-discipline.md](../practices/pr-flow/pr-size-discipline.md) の 200-400 行基準に収める。段階分割は [../practices/pr-flow/stacked-prs.md](../practices/pr-flow/stacked-prs.md) のパターン。

## 受け入れ条件

- [ ] 実装後、Cycle Time 画面の主表示が「上位の遅い PR + 特徴別分布」となり、stage 中央値構成比が主表示の主役ではなくなる
- [ ] 実装後、bot PR とレビューなしマージ PR をフィルタで除外/含めるトグルが動き、既定では除外されている
- [ ] 実装後、PR size 別 (XS / S / M / L / XL) の遅延発生率カードが表示される
- [ ] 実装後、作成曜日別の Pickup / Review 平均カードが表示される
- [ ] 実装後、画面のトップに「中央値が速く見えても遅い側に問題が偏在することがある」旨の説明文が表示される
- [ ] 実装後、Insights の文が「遅い PR の特徴 (size / 曜日 / author 等) の偏り」を述べる構造になる
- [ ] 既存の中央値・stage 構成比表示が、主画面の下部または sub-tab に補助表示として残る
- [ ] `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts` に「上位の遅い PR の集計」「特徴別分布」「bot/レビューなしフィルタ」の代表シナリオが追加され green
- [ ] `pnpm validate` が green
- [ ] 新規 docs / fixture / test に実テナント名・社名・実データ由来の固有数値が含まれない

## リスク・補足

- **bot 判定の精度**: 初期実装は author 名パターンマッチ (Renovate, dependabot[bot], github-actions[bot] 等)。組織固有のボット (社内自動化スクリプト) は漏れる可能性あり。トグルで除外/含むの両方を選べるので、誤判定の影響は限定的
- **「レビューなしマージ」の解釈**: `pull_request_reviews` が 0 件のマージ PR を指す。ただし self-merge / auto-merge / 緊急 hotfix が混ざるため、フィルタ ON 時は「人間レビューを通過した PR のみ」の意味になる。説明文で明示する
- **特徴別カードの組み合わせ爆発**: PR size × 曜日 × 月 × author を全部組み合わせると表示が混雑する。初期は各次元独立のカード (1 次元集計のみ) に絞る
- **過去比較が壊れる懸念**: 既存ユーザーが「先月の median Pickup が 0.5d だった」のような数字を覚えている場合、新主画面では同じ数字が出ない (フィルタ既定で bot 除外、上位の遅い PR 中心)。補助エリアで旧表示と同じ数字も並べることで対応
- **upflow 自身の Coding/Pickup/Review/Deploy のうち Deploy 区間** は今回の主軸スコープ外。Deploy Time の特徴別分析は将来 RDD で扱う ([../practices/delivery/deployment-automation.md](../practices/delivery/deployment-automation.md))
- 中央値の信頼性論点 (#329) は本 RDD で部分的に解消する (中央値を主判断から降格する) が、補助エリアで残す以上、定義と限界の説明は引き続き必要

## Open Questions (人間レビューで解消すべき論点)

1. **「上位 N%」の N をいくつにするか**: 10% / 5% / 1% / 複数同時。デフォルト推奨と切り替え UI の有無
2. **Cycle Time 画面と Review Bottleneck 画面の関係**: 統合する / 相互参照に留める / 役割分担を明確にする (Review Bottleneck は reviewer 視点を残す等)
3. **特徴別カードの組み合わせ**: 1 次元集計のみで開始するか、2 次元クロス (size × 曜日 等) も初期から入れるか
4. **段階移行の期間**: 旧 Bottleneck Mix を補助エリアに残す期間 (永続 / N 期間後に削除 / トグルで完全切替)
5. **フィルタの既定値**: bot 除外を既定に / 全 PR 含むを既定に / org 設定で選べる、のどれにするか
