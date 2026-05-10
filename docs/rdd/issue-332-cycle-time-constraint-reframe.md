# Cycle Time を「症状診断 + 根本原因への深掘り導線」に再フレームする

<!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->

## 背景・課題

Issue #327 で追加された Cycle Time ダッシュボードは、Coding / Pickup / Review の段階時間を **中央値中心** に並列表示し、Bottleneck Mix も段階の中央値または平均の構成比をそのまま比較する構造になっている。Issue #332 はこの構造が **「本当に詰まっているのはどこか」を見せられていない** ことを問題提起している。

複数の実テナントで計測したところ、以下が **テナント横断で共通** していた (詳細は内部調査参照):

- **Pickup と Coding の中央値は数十分以内** (= 半数以上の PR は瞬殺マージ)。中央値で見ると「速い」と読めるが現実を反映していない
- **上位 10% は数日、上位 1% は週単位〜月単位** で停滞する
- 全 PR の `cycle time の合計待ち時間` (= sum of cycle time) の **大半は上位の遅い側 PR が作っている** (上位 10% で 60〜70% 台、上位 1% で 20% 前後)
- 中央値を改善する施策は、上位の遅い PR には効かない (改善余地が遅い側に偏在)
- **PR size が遅延発生率の最強因子** で、サイズ階級 (XS / S / M / L / XL) で長尾発生率が単調増加 (テナントによっては数倍 〜 約 10 倍差)

一方、**テナント間で挙動が分かれる** 観点もあった:

- **Review の中央値**: テナントによって数十分〜約 1 日と幅がある
- **レビューなしマージの率**: テナントによって 10% 台 〜 30% 台後半まで分布
- **Coding の超長期 PR**: テナントによっては p99 が月単位に届く (放置 PR や長期 feature ブランチ起因)

### 制約理論 (Theory of Constraints) 観点での問題定義

Eliyahu Goldratt の "The Goal" / TOC の文脈では、観察される問題を **症状** と **根本原因 (制約)** に分けて扱う必要がある:

- **症状**: 観測できる遅さ (上位の遅い PR、特定段階の長期化、特定 author への偏り)
- **根本原因**: その症状を生んでいる構造的要因 (PR サイズが大きくなる原因、レビュー文化、reviewer 容量、機能分割の困難性、設計結合度、業務優先順位の競合 等)

現行 Cycle Time 画面は **症状すらまともに見せていない** (中央値で見せているため遅い側が消える)。さらに症状から根本原因へ辿る導線も存在しない。改善するには両方が要る:

1. **症状を正確に見せる** (どの PR が、何の特徴を持って遅いか)
2. **根本原因への深掘り導線を提供する** (個別 PR を辿って「なぜ遅いか」の仮説を立てやすくする)
3. **改善対象を提案する** (Insights を症状記述ではなく仮説提示形式に)

これは TOC の 5 focusing steps (Identify / Exploit / Subordinate / Elevate / Repeat) のうち、ダッシュボードで支援できる **Identify** と **Exploit** に対応する。

加えて 2026 年の業界動向 ([../practices/metrics/ai-productivity-paradox.md](../practices/metrics/ai-productivity-paradox.md)) でも、AI コーディング普及で PR サイズ +51.3%、レビューなしマージ +31%、レビュー中央値 +441% の悪化が報告されており (DORA 2025、二次ソース)、本問題は upflow 固有ではなく業界全体の構造問題。

Issue `#331` は「リンク追加」「Insights 文に矢印を足す」型の表面修正として close されている。本 RDD では、Cycle Time ダッシュボードを **症状診断 + 根本原因への深掘り導線** へ再設計する。後方互換性は維持しない (中央値・段階構成比の旧表示は削除する)。

スコープ: PR flow の症状診断と個別 PR の根本原因探索の支援のみ。capacity planning、reviewer 個別割当、リアルタイム alert / notification、TOC の Subordinate / Elevate (実際の改善行動) は本 RDD 対象外。

## 現状実装の確認

### Cycle Time 画面 (置換対象)

- route は `app/routes/$orgSlug/analysis/cycle-time/index.tsx` (`index.tsx:58-60`)
- loader は org / timezone / team / PR title filter を取得 (`index.tsx:80-130`)
- raw データは `getOrgCachedData` 経由で `getCycleTimeRawData` を取得 (`index.tsx:133-157`)
- `clientLoader` は `computeWeeklyTrend` / `computeKpi` / `computeBottleneckMix` / `computeInsights` / `computeAuthorRows` / `computeLongestPrs` を呼ぶ (`index.tsx:187-235`)
- 画面本体は KPI / Weekly Trend / Bottleneck Mix / Insights / By Author / Longest PRs を並列表示 (`index.tsx:403-429`)
- 段階は `coding` / `pickup` / `review` の 3 つに限定、Deploy は除外 (`aggregate.ts:7-18`)
- `computeBottleneckMix` は段階ごとの中央値 / 平均を合計して比率を返す (`aggregate.ts:244-277`)
- `computeInsights` は比率最大の段階を主因として文言化 (`aggregate.ts:319-393`)
- `KpiCards` は `Median Total` / `Avg Total`、`PRs`、`Review (median|avg)` の 3 枚を表示 (`kpi-cards.tsx:23-49`)
- `BottleneckMixCard` は段階構成比を表示 (`bottleneck-mix-card.tsx:16-74`)
- `Longest PRs` 表示は既に存在し、上位の遅い PR を一覧化 (`computeLongestPrs`)

### 既存のフィルタ / 集計 (再利用)

- **`getCycleTimeRawData` は `excludeBots` を常時適用** (`queries.server.ts:47, 96`)。bot 判定は `companyGithubUsers.type = 'Bot'` (`app/libs/tenant-query.server.ts:9-19`)。**新規の bot 検出ロジックは不要**
- **PR title filter** (`excludePrTitleFilters`) も適用済 (`queries.server.ts:48`)
- inventory 画面 (`analysis/inventory/index.tsx:66, 90, 235`) には **bot 除外トグル UI が既に実装済**。Cycle Time 画面に展開可能なパターン
- レビューなしマージ PR は **現状フィルタなし** (`getCycleTimeRawData` の WHERE は `mergedAt is not null` のみ)

### 既存の個別 PR 概要 (再利用)

- PR ごとの概要 popover は `app/services/pr-popover-queries.server.ts` の `getPullRequestForPopover` で実装済 (Issue #314 の RDD 由来)
- popover は title / author / 作成日時 / complexity / review 履歴 / reviewer 状態を返す
- popover route は `app/routes/$orgSlug/resources/pr-popover.$repositoryId.$number.ts`
- 各 PR には GitHub URL (`pull_requests.url`) があり、深掘りはまず GitHub 上で行う前提

### DB

- batch 側の cycle time 定義は `codingTime` / `pickupTime` / `reviewTime` / `deployTime` / `totalTime` (`batch/bizlogic/cycletime.ts:9-110`)
- tenant DB の `pull_requests` には PR timestamp / 段階時間 / PR size / complexity / author を保存。`pull_request_reviews` には reviewer / state / submitted_at (`db/tenant.sql:56-103`)
- shared DB は org 境界、PR データは tenant DB 側 (`db/shared.sql:18-29`)

## 設計判断

### 結論

Cycle Time ダッシュボードを **「症状診断 + 根本原因への深掘り導線」の二層構造** に再設計する:

1. **症状層 (主表示)**: 上位 10% の遅い PR の集約と特徴別分布 (PR size / 曜日 / 月 / author)。「どの PR 群を見るべきか」を示す
2. **個別 PR 深掘り層 (導線)**: Longest PRs と特徴別カードから既存 popover にリンク、popover から GitHub PR URL へ飛んで詳細確認。popover では作成日 / reviewer 状態 / review 履歴を見せ、その PR が「何でつまった可能性があるか」の仮説ヒントを表示
3. **Insights 層 (仮説提示)**: 「上位の遅い PR は X (例: XL サイズ) に偏っている。機能分割困難 / レビュー回避戦略 / 設計結合度のどれが要因か個別 PR で確認推奨」のような **仮説 + 確認の問い** 形式に変更
4. **後方互換性なし**: 中央値・段階構成比 (旧 KpiCards 中央値部分 / BottleneckMixCard / 旧 InsightsCard) は **削除する**。SLO 監視 / 過去比較 が必要なら別画面 / 別 metric として後日新設

### 理由

- **データ起点**: 実テナント計測で「中央値は速い、上位 10% に問題が偏在、合計待ち時間の大半は遅い側」が確認済 (具体値は内部調査参照)。中央値構成比の Bottleneck Mix は意味のある順位を出せていない
- **業界整合**: DORA 2025 で同じパターンが業界規模で確認 ([../practices/metrics/ai-productivity-paradox.md](../practices/metrics/ai-productivity-paradox.md))
- **TOC 整合**: 症状と根本原因を分けないと「症状を改善した気になって本質に届かない」が起きる。dashboard が両者の橋渡しを担う
- **因子の単純化**: 実データで PR size が最強因子、次に作成曜日、次に月単位ばらつき。reviewer 指名はテナントによる。複数因子を pair UI で並べるより「症状 → 個別深掘り → 仮説」の流れに整理する方が実装も解釈も簡潔
- **既存資産の活用**: Longest PRs (`computeLongestPrs`)、PR popover (`getPullRequestForPopover`)、bot 除外フィルタ (`excludeBots`)、トグル UI パターン (inventory 画面) を流用可能。新規実装は最小化
- **後方互換不要**: 中央値・段階構成比の旧表示は意味のある順位を出せない。残置は誤誘導の温床、削除する方が誠実

### 採らなかった代案

- **案 A: 元 RDD の「constraint signal × downstream symptom pair」構造を主軸にする** — 主信号候補が reviewer queue / WIP だったが実データで成立せず、PR size を pair の左側に置くなら「サイズ別段階時間」という単一カードに統合できて pair 構造の必要性が消える。pair UI 自体も画面密度が高く解釈負荷が大きい。採用しない
- **案 B: 中央値の精度改善 (issue #329 系) のみ行う** — 中央値が正確になっても「中央値で診断する」前提自体が誤っているため根本問題は解消しない。採用しない
- **案 C: capacity planning 機能を追加** — 本 RDD のスコープ外。capacity 値の入力モデルが未確定で、診断画面に混ぜると誤判定リスクが増える。採用しない
- **案 D: 中央値・段階構成比を補助エリアに残す (gradual migration)** — 残置は「両方見ていい」というメッセージになり、中央値で診断する誤誘導が温存される。SLO や過去比較の用途は別画面 / 別 metric で扱うべきで、本画面に混在させる理由がない。採用しない
- **案 E: 個別 PR 深掘りを専用画面 (新 route) として新設する** — popover で概要を見て GitHub URL に飛ぶ既存導線で十分なケースが多く、専用画面の追加は早すぎる。専用画面化は popover での仮説ヒント運用後に必要性が見えてから判断 (Open Questions)。採用しない

## 要件

### 機能

- ユーザーは画面を開いたとき、**主表示として「上位 10% の遅い PR とその特徴」** を確認できる
- ユーザーは PR の **PR size、作成曜日、月、author 分布** で遅延の偏りを画面上で識別できる
- ユーザーは **bot PR の除外/含む** をトグルで切り替えられる (既定: 除外、現状の挙動を維持)
- ユーザーは **レビューなしマージ PR の除外/含む** をトグルで切り替えられる (既定: 除外。テナント間で 10% 台 〜 30% 台後半に分布するため、含む既定だと数値が誤解を招くテナントが出る)
- ユーザーは Longest PRs / 特徴別カードから **個別 PR の popover** を開ける (既存 `getPullRequestForPopover` を活用)
- ユーザーは popover 上で **その PR の仮説ヒント** (例: 「XL サイズ」「金曜作成 → 週末越え」「reviewer 指名なし」) を読める
- ユーザーは popover から **GitHub PR URL** に飛んで詳細 (commits, comments, discussion) を確認できる
- ユーザーは Insights で **「症状の偏り + 仮説 + 確認すべき問い」** を含む文を読める (例: 「上位 10% の半数が XL サイズ。機能分割困難 / レビュー回避戦略 / 設計結合度のどれが要因か個別 PR で確認推奨」)
- 既存の period / team / repository / PR title filter は維持

### 非機能

- 集計は既存の 5 分 cache 範囲で再計算可能なコストに収める
- bot 除外トグルの既定は現状の挙動 (除外) を維持
- レビューなしマージは既定除外。トグル OFF にすれば現状の数字も確認できる
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

### 削除

- `app/routes/$orgSlug/analysis/cycle-time/+components/bottleneck-mix-card.tsx` — Bottleneck Mix カード全体を削除
- `app/routes/$orgSlug/analysis/cycle-time/+components/kpi-cards.tsx` の中央値関連 KPI を削除
- `app/routes/$orgSlug/analysis/cycle-time/+components/insights-card.tsx` の旧 Insight 文 (主因段階の言及) を削除し、新仕様で置き換え
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.ts` の `computeBottleneckMix` / `computeInsights` (旧仕様) を削除

### 追加 / 改修

- `app/routes/$orgSlug/analysis/cycle-time/+functions/queries.server.ts:10-65`
  - `pull_request_reviews` を JOIN し、レビュー数 0 件の判定を select に追加
  - `excludeBots` の適用を **URL param で切り替え可能** に変更 (現状は常時適用)
  - レビューなし除外も URL param で切り替え可能に
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.ts`
  - 上位 10% の遅い PR の集計関数を追加 (件数、合計待ち時間、平均期間)
  - PR size / 曜日 / 月 / author 別の遅延発生率の集計関数を追加
  - 仮説ヒント生成関数を追加 (個別 PR の特徴から「XL サイズ」「金曜作成」「reviewer 指名なし」等のラベルを返す)
  - 新 Insights 生成関数を追加 (症状の偏りを述べた上で仮説と確認の問いを返す)
- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:80-235`
  - URL param `excludeBots` / `excludeNoReviewMerges` の解釈を loader / clientLoader に追加
  - cache key に上記パラメータを含める (`analysis/inventory/index.tsx:76` 参照)
- `app/routes/$orgSlug/analysis/cycle-time/index.tsx:403-429`
  - 主表示エリアを「上位の遅い PR の概要 + 特徴別分布カード + Longest PRs + Insights (仮説形式)」に置換
- `app/routes/$orgSlug/analysis/cycle-time/+components/` に追加
  - 上位の遅い PR の概要カード (件数、合計待ち時間、平均期間)
  - 特徴別分布カード (PR size 別 / 曜日別 / 月別 / author 別の遅延発生率)
  - 仮説形式の Insights カード
- 既存 PR popover (`app/services/pr-popover-queries.server.ts`) を拡張
  - 仮説ヒント (PR size、作成曜日、reviewer 状態などから生成) を popover データに含める
  - popover の表示コンポーネントで仮説ヒントを表示 + GitHub URL リンクを目立たせる
- bot / レビューなしマージのトグル UI は inventory 画面 (`analysis/inventory/index.tsx:235`) のパターンを流用
- `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts` に新集計関数の代表シナリオを追加 (上位 10% 集計、特徴別分布、レビューなしマージ分離、仮説ヒント生成、新 Insights)

## UI 変更

主要画面のドラフト構造:

```text
Cycle Time 診断
目的: 遅い PR を見つけて、何で詰まっているかの仮説を立て、個別に深掘りする。
注意: 中央値が速く見えても、遅い側 PR が体感の遅さを支配することがある。
業界文脈: DORA 2025 ではレビュー時間 +441%、PR サイズ +51.3% の悪化が報告されている。

フィルタ: [✓ bot を除外] [✓ レビューなしマージを除外] [reset]

+---------------------------------------------------------------+
| 主指標 (症状)                                                  |
| 上位 10% の遅い PR: N 件 | 合計待ち時間に占める割合: X%       |
+---------------------------------------------------------------+

+-----------------------------+  +-----------------------------+
| 遅い PR の特徴別分布 (症状) |  | Longest PRs (上位 20)       |
| - PR size 別 (XS-XL) 遅延率 |  | - 合計時間で並べる          |
| - 作成曜日別                |  | - クリックで popover 起動   |
| - 月別                      |  | - popover から GitHub へ    |
| - author 別                 |  |                             |
+-----------------------------+  +-----------------------------+

+---------------------------------------------------------------+
| Insights (仮説 + 確認の問い)                                   |
| 上位 10% の半数が XL サイズ。機能分割困難 / レビュー回避戦略 / |
| 設計結合度のどれが要因か個別 PR で確認推奨。                   |
| 加えて金曜作成が上位 10% で 30% 占有 (全体平均 14%)。          |
| 週末越えを誘発している可能性、リリース前駆け込み投入の有無を   |
| 個別 PR で確認推奨。                                           |
+---------------------------------------------------------------+
```

個別 PR popover (既存拡張):

```text
PR #1234 [GitHub で詳細 →]

タイトル: ...
作成: 2026-05-08 (金) | author: alice | size: 1,234 行 (XL)
reviewer: bob (指名済), carol (未対応) | review 履歴: 2 件のコメント

仮説ヒント (この PR が遅い可能性のある要因):
- XL サイズ (1,000 行超): 機能分割や stacked PR の活用を検討
- 金曜作成: 週末越えで pickup が伸びた可能性
- reviewer 指名から first review まで 3 日: reviewer 容量の問題か
```

## 移行方針

**一気に置換する**。後方互換性は維持しない。

- 旧 Bottleneck Mix / 中央値 KPI / 旧 Insights は削除
- 新主表示と個別 PR popover の仮説ヒントを同 PR で投入

理由:

- 中央値・段階構成比を残すと「両方見ていい」と誤読される。誤誘導の温床は削除する方が誠実
- SLO 監視 / 過去比較が後で必要になれば、別画面 / 別 metric として新設する (本 RDD で混ぜない)
- 既存ユーザーへの説明: 「中央値で診断する画面ではなく、遅い PR を診断する画面に変わる」を画面冒頭の説明文と onboarding tooltip で明示

段階分割案 (stacked PR の粒度):

1. **集計層**: 上位 N% / 特徴別分布 / レビューなしマージ判定 / 仮説ヒント生成 / 新 Insights の集計関数を `aggregate.ts` に追加 + テスト
2. **query 層 + URL param**: `excludeBots` / `excludeNoReviewMerges` の URL param 化、`pull_request_reviews` JOIN 追加、cache key 拡張
3. **popover 拡張**: `getPullRequestForPopover` に仮説ヒントを追加、popover の表示コンポーネントを更新
4. **表示層 + 旧表示削除**: 主表示を新コンポーネントに置換、旧 BottleneckMixCard / 旧 KpiCards 中央値部分 / 旧 InsightsCard を削除、トグル UI を inventory パターンで追加
5. **説明文 / onboarding**: 画面冒頭の説明文と DORA 2025 文脈、新画面の意図を読み取れる copy を追加

各 PR のサイズは [../practices/pr-flow/pr-size-discipline.md](../practices/pr-flow/pr-size-discipline.md) の 200-400 行基準に収める。段階分割は [../practices/pr-flow/stacked-prs.md](../practices/pr-flow/stacked-prs.md) のパターン。

## 受け入れ条件

- [ ] 実装後、Cycle Time 画面の主表示で **上位 10% の遅い PR の件数と合計待ち時間** が確認できる
- [ ] 実装後、ユーザーは画面上で **PR size、作成曜日、月、author** のどれに遅い PR が偏っているかを識別できる
- [ ] 実装後、bot 除外トグルが操作でき、既定で除外、トグル OFF で含めた集計に切り替わる
- [ ] 実装後、レビューなしマージの除外トグルが操作でき、既定で除外、トグル OFF で含めた集計に切り替わる
- [ ] 実装後、Longest PRs / 特徴別カードから個別 PR の popover を開ける
- [ ] 実装後、popover に **その PR の仮説ヒント** (例: XL サイズ、金曜作成、reviewer 状態) と **GitHub PR へのリンク** が表示される
- [ ] 実装後、Insights には「症状の偏り + 仮説 + 確認すべき問い」を含む文が表示される
- [ ] 実装後、旧 Bottleneck Mix / 旧 中央値 KPI / 旧 Insights が画面から削除されている
- [ ] 画面冒頭で「中央値で診断する画面ではなく、遅い PR を診断する画面である」旨の説明が表示される
- [ ] `app/routes/$orgSlug/analysis/cycle-time/+functions/aggregate.test.ts` に「上位 10% 集計」「特徴別分布 (PR size, 曜日, 月)」「レビューなしマージ分離」「仮説ヒント生成」「新 Insights」の代表シナリオが追加され green
- [ ] `pnpm validate` が green
- [ ] 新規 docs / fixture / test に実テナント名・社名・実データ由来の固有数値が含まれない

## リスク・補足

- **「レビューなしマージ」の解釈**: `pull_request_reviews` が 0 件のマージ PR を指す。self-merge / auto-merge / 緊急 hotfix が混在するため、除外時は「人間レビューを通過した PR のみ」の意味になる。説明文で明示する
- **テナント間の差**: 複数テナントで実データを比較したところ、Pickup と Coding の中央値は機能していない傾向は共通だが、Review 中央値・レビューなしマージ率・Coding の超長期 PR の有無はテナント差が大きい。本 RDD の主軸 (上位の遅い PR の症状診断 + 個別深掘り) はこの差を吸収できる
- **Coding 段階の超長期 PR**: テナントによっては Coding p99 が月単位に届く (放置 PR、長期 feature ブランチ、長期保留 draft が混入)。これは「上位の遅い PR」として自然に主表示に乗るが、性質が「単一の遅い PR」というより「放置 PR の検出」なので、Insights / 仮説ヒントで「Coding の超長期は放置 PR の可能性」と判定する余地あり (Open Questions)
- **後方互換性の喪失**: 既存ユーザーが「先月の Pickup 中央値が X だった」のような数字を覚えている場合、新画面では同じ表示が出ない。これは意図された変更で、画面冒頭の説明文で意図を明示する。SLO 監視 / 過去比較が必要なら別画面 / 別 metric として新設する判断は別途 (本 RDD の対象外)
- **仮説ヒントの過剰表示リスク**: 個別 PR ごとに 5 個も 6 個もヒントを表示すると認知負荷が高い。初期は 1-3 個に絞る (PR size, 作成曜日, reviewer 状態の 3 軸)。それ以上は popover が肥大化する
- **upflow 自身の Coding/Pickup/Review/Deploy のうち Deploy 区間** は本 RDD のスコープ外。Deploy Time の症状診断は別 RDD で扱う ([../practices/delivery/deployment-automation.md](../practices/delivery/deployment-automation.md))
- **TOC の Subordinate / Elevate** は本 RDD のスコープ外。dashboard が支援するのは Identify (どこが症状か) と Exploit (どう深掘って原因を絞るか) まで。実際の改善行動 (PR サイズ規律導入、レビュー文化変更、アーキ再設計) は人間 / 組織が行う

## Open Questions (人間レビューで解消すべき論点)

1. **「上位 N%」の N の最終値**: 本 RDD は暫定で 10% を採用しているが、5% / 1% / 複数同時 (10%/1% 並列表示) との比較が要る。N の切り替え UI を持つかも判断対象
2. **Cycle Time 画面と Review Bottleneck 画面の役割分担**: 統合 / 相互参照 / 役割分担明確化 (Review Bottleneck は reviewer 視点に特化、Cycle Time は PR 視点) のどれにするか。本 RDD では「相互参照」前提だが、Review Bottleneck 画面の今後のあり方とセットで決める必要
3. **フィルタ既定値のテナント設定対応**: レビューなしマージ率がテナント間で 10% 台 〜 30% 台後半まで分布するため、既定値を `organizationSettings` 等で持つかどうか。本 RDD は全テナント共通の「除外既定 + トグル切替」で開始するが、運用してから設定化が必要になる可能性あり (スキーマ変更を伴うため別 RDD で扱う)
4. **Coding 段階の超長期 PR (放置 PR) の扱い**: テナントによっては Coding p99 が月単位に届き、これは「停滞している PR」「長期 draft」など性質が違う。本 RDD の主表示には自然に含まれるが、Insights / 仮説ヒントで「放置 PR の可能性あり」と別ラベルを付けるか、別画面 / 別 RDD で扱うか
5. **個別 PR 深掘り専用画面の新設可否**: 本 RDD は popover + GitHub URL で深掘りを成立させる前提。popover が肥大化したり、組織内で PR ごとに annotated 議論を残したい要件が出たら、専用画面 (新 route) を検討。本 RDD では Open Questions に留め、popover 運用後の判断対象にする
6. **仮説ヒントの精度と表現**: 「金曜作成 → 週末越え」「XL サイズ → 機能分割困難」のような仮説は **可能性の提示** であって因果ではない。表現が「断定」と読まれない工夫 (「〜の可能性」「〜を確認推奨」「〜要因の候補の一つ」等) と、組織別チューニング (組織独自の業務カレンダーを反映する等) をどこまでやるか
