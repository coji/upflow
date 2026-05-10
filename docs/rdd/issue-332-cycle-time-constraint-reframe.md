# Cycle Time を「上位の遅い PR の診断」起点に再フレームする

<!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->

## 背景・課題

Issue #327 で追加された Cycle Time ダッシュボードは、Coding / Pickup / Review の段階時間を **中央値中心** に並列表示し、Bottleneck Mix も段階の中央値または平均の構成比をそのまま比較する構造になっている。Issue #332 はこの構造が **「本当に詰まっているのはどこか」を見せられていない** ことを問題提起している。

複数の実テナントで計測したところ、以下が **テナント横断で共通** していた (詳細は内部調査参照):

- **Pickup と Coding の中央値は数十分以内** (= 半数以上の PR は瞬殺マージ)。中央値で見ると「速い」と読めるが、これは現実を反映していない
- **上位 10% は数日、上位 1% は週単位〜月単位** で停滞する
- 全 PR の `cycle time の合計待ち時間` (= sum of cycle time) の **大半は上位の遅い側 PR が作っている** (上位 10% で 60〜70% 台、上位 1% で 20% 前後)
- 中央値を改善する施策は、上位の遅い PR には効かない (改善余地が遅い側に偏在)
- **PR size が遅延発生率の最強因子** で、サイズ階級 (XS / S / M / L / XL) で長尾発生率が単調増加 (テナントによっては数倍 〜 約 10 倍差)

一方、**テナント間で挙動が分かれる** 観点もあった:

- **Review の中央値**: テナントによって数十分〜約 1 日と幅がある。Review に限っては中央値も SLA 判断材料として使える場合がある
- **レビューなしマージの率**: テナントによって 10% 台 〜 30% 台後半まで分布。フィルタの既定値選択に影響
- **Coding の超長期 PR**: テナントによっては p99 が月単位に届く (放置 PR や長期 feature ブランチ起因)

これらの発見は、「中央値中心の表示が PR flow の実態を捉えていない」という主張を テナント横断で支持する一方、Review 中央値とフィルタ既定値については **テナント設定で調整可能** にすべきことを示唆する。

中央値中心の現行表示は、**少なくとも Pickup と Coding についてはボトルネックの所在を逆方向に誤誘導している**。改善すべきは中央値ではなく「**遅い側の PR が何で詰まっているか**」を診断すること。

加えて 2026 年の業界動向 ([../practices/metrics/ai-productivity-paradox.md](../practices/metrics/ai-productivity-paradox.md)) でも、AI コーディング普及で PR サイズ +51.3%、レビューなしマージ +31%、レビュー中央値 +441% の悪化が報告されており (DORA 2025、二次ソース)、本問題は upflow 固有ではなく業界全体の構造問題。

Issue `#331` は「リンク追加」「Insights 文に矢印を足す」型の表面修正として close されている。本 RDD では、Cycle Time ダッシュボードを **遅い側 PR の特徴別診断画面** へ再設計する。

スコープ: PR flow の診断のみ。capacity planning、reviewer 個別割当、リアルタイム alert / notification は本 RDD 対象外。

## 現状実装の確認

### 画面構成 / 集計

- Cycle Time 画面の route は `app/routes/$orgSlug/analysis/cycle-time/index.tsx` (`index.tsx:58-60`)
- loader は org / timezone / team / PR title filter を取得し、`period`、`metric`、`repository` を query から解釈 (`index.tsx:80-130`)
- raw データは `getOrgCachedData` 経由で `getCycleTimeRawData` を current / previous period 分取得 (`index.tsx:133-157`)
- `clientLoader` は `computeWeeklyTrend` / `computeKpi` / `computeBottleneckMix` / `computeInsights` / `computeAuthorRows` / `computeLongestPrs` を呼ぶ (`index.tsx:187-235`)
- 画面本体は KPI / Weekly Trend / Bottleneck Mix / Insights / By Author / Longest PRs を並列表示 (`index.tsx:403-429`)
- 段階は `coding` / `pickup` / `review` の 3 つに限定、Deploy は除外 (`aggregate.ts:7-18`)
- `computeBottleneckMix` は段階ごとの中央値 / 平均を合計して比率を返す (`aggregate.ts:244-277`)
- `computeInsights` は比率最大の段階を主因として文言化 (`aggregate.ts:319-393`)
- `KpiCards` は `Median Total` / `Avg Total`、`PRs`、`Review (median|avg)` の 3 枚を表示 (`kpi-cards.tsx:23-49`)
- `BottleneckMixCard` は段階構成比を表示 (`bottleneck-mix-card.tsx:16-74`)
- `Longest PRs` 表示は既に存在し、上位の遅い PR を一覧化 (`computeLongestPrs`)

### 既存のフィルタ / 集計層 (再利用可能)

- **`getCycleTimeRawData` は `excludeBots` を常時適用** (`queries.server.ts:47, 96`)。bot 判定は `companyGithubUsers.type = 'Bot'` (`app/libs/tenant-query.server.ts:9-19`)。**新規の bot 検出ロジックは不要**
- `getCycleTimeRawData` は **PR title filter** (`excludePrTitleFilters`) も適用済 (`queries.server.ts:48`)
- inventory 画面 (`analysis/inventory/index.tsx:66, 90, 235`) には **bot 除外トグル UI が既に実装済** (URL param `excludeBots=0` で含める)。Cycle Time 画面に展開可能なパターン
- レビューなしマージ PR は **現状フィルタなし** (`getCycleTimeRawData` の WHERE は `mergedAt is not null` のみ)。`pull_request_reviews` JOIN を追加すれば計算できる
- batch 側の cycle time 定義は `codingTime` / `pickupTime` / `reviewTime` / `deployTime` / `totalTime` (`batch/bizlogic/cycletime.ts:9-110`)

### 関連画面 / DB

- Review Bottleneck 画面 (別 route) は `Review Queue Trend` / `WIP Count vs Review Time` / `PR Size Distribution & Review Time` を表示 (`analysis/reviews/index.tsx:244-248`)
- `getPRSizeDistribution` は merged PR の additions / deletions / reviewTime / pickupTime / complexity を返す (`analysis/reviews/+functions/queries.server.ts:170-230`)
- tenant DB の `pull_requests` には PR timestamp / 段階時間 / PR size (additions, deletions) / complexity / author を保存。`pull_request_reviews` には reviewer / state / submitted_at (`db/tenant.sql:56-103`)
- shared DB は org 境界、PR データは tenant DB 側 (`db/shared.sql:18-29`)

## 設計判断

### 結論

Cycle Time ダッシュボードを **「中央値中心の段階並列表示」から「上位の遅い PR の特徴別診断」へ移行** する。具体的には:

1. **主表示は「上位 10% の遅い PR」とその特徴別分布** (PR size、作成曜日、月、author 分布)
2. **bot 除外トグル** (現状の常時除外 → デフォルト除外 + 含めるトグル) と **レビューなしマージ分離** (新規) を画面に追加
3. 中央値・段階構成比は **「過去比較・SLO 監視用の補助表示」** として残置 (削除しない)
4. 業界文脈 (DORA 2025) を画面冒頭の説明文に明示し、「中央値で速く見えても遅い側に問題が偏在する」現象を読み手に説明

### 理由

- **データ起点**: 実テナント計測で「中央値は速い、上位 10% に問題が偏在、合計待ち時間の大半は遅い側」が確認済 (具体値は内部調査参照)。中央値構成比の Bottleneck Mix は意味のある順位を出せていない
- **業界整合**: DORA 2025 で同じパターンが業界規模で確認されており、AI 時代に強化される問題。upflow は「検出側の dashboard」としてこの現象を可視化する位置にある ([../practices/metrics/ai-productivity-paradox.md](../practices/metrics/ai-productivity-paradox.md))
- **因子の単純化**: 実データで因子の効き目を見ると **PR size が最強** (XS と XL で遅延発生率に数倍差)、次に **作成曜日** (金曜投入は週末越え)、次に **月単位ばらつき**。reviewer 指名は大半の PR で行われていないため reviewer queue / WIP は弱い。元 RDD の「主信号 = reviewer queue」という仮説を否定する
- **既存資産の活用**: Longest PRs 表示は既に存在 (`computeLongestPrs`)。bot 除外フィルタも既存 (`excludeBots`)、トグル UI パターンも inventory 画面に実装済。新規実装は最小化できる
- **Pair 表示は副次扱い**: 元 RDD の「上流 signal × 下流段階時間 pair」は主信号が PR size であれば「PR size 別の段階時間分布」という単一カードに統合できる。階層 pair UI は不要

### 採らなかった代案

- **案 A: 元 RDD のまま「constraint signal × downstream symptom pair」を主軸にする** — 主信号候補が reviewer queue / WIP だったが実データで成立せず、PR size を pair の左側に置くなら「サイズ別段階時間」という単一カードに統合できて pair 構造の必要性が消える。pair UI 自体も画面密度が高く解釈負荷が大きい (上流 / 下流の対応関係を読者が辿る必要)。採用しない
- **案 B: 中央値の精度改善 (issue #329 系) のみ行う** — 中央値が正確になっても「中央値で診断する」前提自体が誤っているため、根本問題は解消しない。採用しない
- **案 C: capacity planning 機能を追加** — Issue #332 のスコープ外。capacity 値の入力モデルが未確定で、診断画面に混ぜると誤判定リスクが増える。採用しない
- **案 D: Bottleneck Mix を完全削除して全部 Longest PRs に集約** — 中央値・段階構成比は SLO 監視や過去 dashboard との比較で正当な用途がある。完全削除はオンボーディング負荷を上げる。補助表示として残置する案を採用

## 要件

### 機能

- ユーザーは画面を開いたとき、**主表示として「上位 10% の遅い PR とその特徴」** を確認できる
- ユーザーは PR の **PR size、作成曜日、月、author 分布** で遅延の偏りを画面上で識別できる
- ユーザーは **bot PR の除外/含む** をトグルで切り替えられる (既定: 除外、現状の挙動を維持)
- ユーザーは **レビューなしマージ PR の除外/含む** をトグルで切り替えられる (既定: 除外。テナント間でレビューなしマージ率が大きく異なる [10% 台 〜 30% 台後半] ため、含む既定だと数値が誤解を招くテナントが出る)
- ユーザーは Insights で「上位の遅い PR が何の特徴 (size / 曜日 / author 等) に偏っているか」を読める
- ユーザーは **中央値と段階構成比** を補助表示で参照できる (主画面の下部または別タブ)
- ユーザーは画面冒頭の説明文で「中央値が良くても遅い側に問題が偏在することがある」前提を読める
- 既存の period / team / repository / PR title filter は維持

### 非機能

- 集計は既存の 5 分 cache 範囲で再計算可能なコストに収める
- 既存ユーザーへの影響を抑える: bot 除外既定は現状と同じ (常時除外 → デフォルト除外 + トグルで含む可能)
- レビューなしマージは既定除外。トグル OFF にすれば現状の数字 (含めた集計) も確認できる。テナント設定で既定値を上書きできるようにするかは Open Questions で扱う
- tenant DB の org scoping は既存どおり (`getTenantDb(organizationId)`)
- 実テナント名・社名・実データ由来の固有数値を新規 docs / fixture / test に含めない (NDA 配慮、`docs/agent-rules/confidentiality.md` 参照)

## スキーマ変更

スキーマ変更なし。

PR size、作成曜日、月、author、レビューなしマージ区分はすべて現状の tenant DB から計算可能:

- PR size: `pull_requests.additions + deletions`
- 作成曜日 / 月: `pull_requests.pull_request_created_at` を組織 timezone で変換
- author: `pull_requests.author`
- レビューなしマージ: `pull_request_reviews` を JOIN して count = 0 を判定
- bot 判定: 既存の `companyGithubUsers.type = 'Bot'` (`app/libs/tenant-query.server.ts:excludeBots`) をそのまま利用

## アプリケーション変更

### 必須

- `app/routes/$orgSlug/analysis/cycle-time/+functions/queries.server.ts:10-65`
  - `pull_request_reviews` を JOIN し、レビュー数 0 件の判定を select に追加
  - `excludeBots` の適用を **URL param で切り替え可能** に変更 (現状は常時適用)
  - レビューなし除外も URL param で切り替え可能に
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.ts`
  - 上位 10% の遅い PR の集計を追加 (`computeSlowPrSummary` 等)
  - PR size / 曜日 / 月 / author 別の遅延発生率の集計を追加
  - `computeInsights` を「主因の段階」から「遅い PR の特徴の偏り」を述べる出力に変更
  - 既存 `computeBottleneckMix` / `computeKpi` の中央値出力は維持 (補助表示で使う)
- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:80-235`
  - URL param `excludeBots` / `excludeNoReviewMerges` の解釈を loader / clientLoader に追加
  - cache key に上記パラメータを含める (`analysis/inventory/index.tsx:76` 参照)
- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:403-429`
  - 新主表示エリア (上位の遅い PR + 特徴別分布) を追加、補助エリア (中央値 / 段階構成比) を下部または別タブに配置
- `app/routes/$orgSlug/analysis/cycle-time/+components/` に以下を追加または改修
  - 上位の遅い PR の概要カード (件数、合計待ち時間、平均期間)
  - 特徴別分布カード (PR size 別 / 曜日別 / 月別 / author 別の遅延発生率)
  - 既存 `bottleneck-mix-card.tsx` / `kpi-cards.tsx` / `insights-card.tsx` は補助表示用にそのまま保持
- bot / レビューなしマージのトグル UI は inventory 画面 (`analysis/inventory/index.tsx:235`) のパターンを流用
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts` に新集計関数の代表シナリオを追加 (上位 10% の集計、PR size 別、曜日別、レビューなしマージ分離)

### 補助 (本 RDD の主軸ではないが整合のため触れる)

- 画面の説明文 / onboarding copy を `index.tsx` に追加 (中央値の限界と遅い PR 偏在の説明)

## UI 変更

主要画面のドラフト構造:

```text
Cycle Time Diagnosis
目的: 遅い PR を見つけて、何で詰まっているかを診断する。
注意: 中央値が速く見えても、遅い側 PR が体感の遅さを支配することがある。
業界文脈: DORA 2025 ではレビュー時間 +441%、PR サイズ +51.3% の悪化が報告されている。

フィルタ: [✓ bot を除外] [□ レビューなしマージを除外] [reset]

+---------------------------------------------------------------+
| 主指標                                                         |
| 上位 10% の遅い PR: N 件 | 合計待ち時間に占める割合: X%       |
+---------------------------------------------------------------+

+-----------------------------+  +-----------------------------+
| 遅い PR の特徴別分布        |  | Longest PRs (上位 20)       |
| - PR size 別 (XS-XL) 遅延率 |  | - 合計時間で並べる          |
| - 作成曜日別                |  | - author / size / 作成日    |
| - 月別                      |  |                             |
| - author 別                 |  |                             |
+-----------------------------+  +-----------------------------+

+---------------------------------------------------------------+
| Insights                                                      |
| 遅い PR の偏り: 大きい size (XL)、金曜作成、特定 author       |
| Pickup の中央値は 1 時間以内だが、上位 10% は 4 日超          |
+---------------------------------------------------------------+

+---------------------------------------------------------------+
| 補助表示: 中央値ビュー / 段階構成比                            |
| Coding / Pickup / Review の中央値、段階構成比 (SLO / 履歴)    |
+---------------------------------------------------------------+
```

中央値表示は完全廃止しない。SLO 監視や過去 dashboard との比較用途を補助エリアで維持。**主画面では中央値を主判断材料として見せない**。

## 移行方針

新主画面と旧表示を **同一 route 内で構造的に分離** する (主表示と補助表示)。理由:

- 既存ユーザーが #327 表示に慣れている可能性があり、route 完全置換はオンボーディング負荷大
- 「主と補助」を明示することで、新画面の意図 (中央値ではなく遅い PR を見ろ) を読み取りやすくする
- ロールバックは「主と補助の入れ替え」で対応可能。**補助エリアは永続的に残す方針** (削除予定なし、SLO / 過去比較の用途あり)

段階分割案 (stacked PR の粒度):

1. **集計層**: 上位 N% / 特徴別 (size / 曜日 / 月 / author) / レビューなしマージ判定の集計関数を `aggregate.ts` に追加 + テスト
2. **query 層 + URL param**: `excludeBots` / `excludeNoReviewMerges` の URL param 化、`pull_request_reviews` JOIN 追加、cache key 拡張
3. **表示層**: 新主表示エリア (上位の遅い PR + 特徴別分布) を実装、トグル UI を inventory 画面パターンで追加
4. **配置と説明文**: 旧 Bottleneck Mix を補助エリアに移動、画面冒頭の説明文と DORA 2025 文脈を追加

各 PR のサイズは [../practices/pr-flow/pr-size-discipline.md](../practices/pr-flow/pr-size-discipline.md) の 200-400 行基準に収める。段階分割は [../practices/pr-flow/stacked-prs.md](../practices/pr-flow/stacked-prs.md) のパターン。

## 受け入れ条件

- [ ] 実装後、Cycle Time 画面の主表示で **上位 10% の遅い PR の件数と合計待ち時間** が確認できる
- [ ] 実装後、ユーザーは画面上で **PR size、作成曜日、月、author** のどれに遅い PR が偏っているかを識別できる
- [ ] 実装後、bot 除外トグルが操作でき、既定で除外、トグル OFF で含めた集計に切り替わる
- [ ] 実装後、レビューなしマージの除外トグルが操作でき、既定で含む、トグル ON で除外した集計に切り替わる
- [ ] 実装後、中央値と段階構成比 (旧 Bottleneck Mix の数値) は画面下部または別タブから参照できる
- [ ] 実装後、画面冒頭で「中央値が速く見えても遅い側に問題が偏在することがある」前提を説明する文が表示される
- [ ] 実装後、Insights には「遅い PR がどの特徴に偏っているか (例: size、曜日、author)」を含む文が出る
- [ ] `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts` に「上位 10% 集計」「特徴別分布 (PR size, 曜日, 月)」「レビューなしマージ分離」の代表シナリオが追加され green
- [ ] `pnpm validate` が green
- [ ] 新規 docs / fixture / test に実テナント名・社名・実データ由来の固有数値が含まれない

## リスク・補足

- **「レビューなしマージ」の解釈**: `pull_request_reviews` が 0 件のマージ PR を指す。self-merge / auto-merge / 緊急 hotfix が混在するため、除外時は「人間レビューを通過した PR のみ」の意味になる。説明文で明示する
- **テナント間の差**: 複数テナントで実データを比較したところ、Pickup と Coding の中央値は機能していない傾向は共通だが、Review 中央値・レビューなしマージ率・Coding の超長期 PR の有無はテナント差が大きい。本 RDD の主軸 (上位の遅い PR の特徴別診断) はこの差を吸収できるが、フィルタ既定値や説明文の表現は慎重にする
- **Coding 段階の超長期 PR**: テナントによっては Coding p99 が月単位に届く (放置 PR、長期 feature ブランチ、長期保留 draft が混入)。これは「上位の遅い PR」として自然に主表示に乗るが、性質が「単一の遅い PR」というより「放置 PR の検出」なので、Insights で「Coding の超長期 PR は放置 PR の可能性、別途確認推奨」と明示する余地がある (本 PR では実装せず、Open Questions に留める)
- **特徴別カードの組み合わせ爆発**: PR size × 曜日 × 月 × author を全部組み合わせると表示が混雑する。**初期は各次元独立のカード (1 次元集計のみ) に絞る**
- **過去比較が壊れる懸念**: 既存ユーザーが「先月の Pickup 中央値が X だった」のような数字を覚えている場合、新主画面では同じ数字が出ない (主軸が変わるため)。補助エリアで旧表示と同じ数字も並べることで対応
- **bot 除外トグル既定**: 既存の `excludeBots` 常時除外と挙動を変えないため、既定 ON にする。トグル OFF にできることだけ追加 (既存ユーザーへの影響なし)
- **upflow 自身の Coding/Pickup/Review/Deploy のうち Deploy 区間** は今回の主軸スコープ外。Deploy Time の特徴別分析は別 RDD で扱う ([../practices/delivery/deployment-automation.md](../practices/delivery/deployment-automation.md))
- **中央値の信頼性論点 (#329)** は本 RDD で部分的に解消する (中央値を主判断から降格する) が、補助エリアで残す以上、定義と限界の説明は引き続き必要

## Open Questions (人間レビューで解消すべき論点)

1. **「上位 N%」の N の最終値**: 本 RDD は暫定で 10% を採用しているが、5% / 1% / 複数同時 (10%/1% 並列表示) との比較が要る。N の切り替え UI を持つかも判断対象
2. **Cycle Time 画面と Review Bottleneck 画面の役割分担**: 統合 / 相互参照 / 役割分担明確化 (Review Bottleneck は reviewer 視点に特化、Cycle Time は PR 視点) のどれにするか。本 RDD では「相互参照」前提だが、Review Bottleneck 画面の今後のあり方とセットで決める必要
3. **フィルタ既定値のテナント設定対応**: レビューなしマージ率がテナント間で 10% 台 〜 30% 台後半まで分布するため、既定値を `organizationSettings` 等で持つかどうか。本 RDD は全テナント共通の「除外既定 + トグル切替」で開始するが、運用してから設定化が必要になる可能性あり (スキーマ変更を伴うため別 RDD で扱う)
4. **Coding 段階の超長期 PR (放置 PR) の扱い**: テナントによっては Coding p99 が月単位に届き、これは「停滞している PR」「長期 draft」など性質が違う。本 RDD の主表示には自然に含まれるが、Insights で「放置 PR の可能性あり」と別ラベルを付けるか、別画面 / 別 RDD で扱うか
