# Issue #307 RDD: PR タイトルパターンによる表示フィルター

## 背景・課題

特定のタイトルパターンを持つ PR は、サイクルタイム分析や Review Stacks のようなビューでノイズになる。具体例:

- `[DO NOT MERGE]` 付き PR — マージ予定が無く、開いたまま放置されるので open 系ビューを埋める
- `[EPIC-xxx]` 付き PR — 長期間オープンの集約用 PR で、個別の pickup / review / coding time として計測しても意味がない
- チームによっては `[DO NOT MERGE][EPIC-123]` がテンプレート化されている

これらの PR がメトリクスに混じると、平均サイクルタイムや review stack の件数が実態と乖離する。現状ユーザーは除外手段を持たないため、数字の信頼性が損なわれている。

## 現状実装の確認

### PR を読む query 経路

tenant DB の `pullRequests` を参照する経路は、ビュー表示・raw export・batch の 3 系統に分かれる。

UI 表示系 (本 issue のフィルタ適用対象):

- [`app/routes/$orgSlug/workload/+functions/stacks.server.ts`](../../app/routes/$orgSlug/workload/+functions/stacks.server.ts) — Review Stacks 用 open PR
- [`app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`](../../app/routes/$orgSlug/workload/$login/+functions/queries.server.ts) — 個人 workload
- [`app/routes/$orgSlug/throughput/ongoing/+functions/queries.server.ts`](../../app/routes/$orgSlug/throughput/ongoing/+functions/queries.server.ts) — オープン PR throughput
- [`app/routes/$orgSlug/throughput/merged/+functions/queries.server.ts`](../../app/routes/$orgSlug/throughput/merged/+functions/queries.server.ts) — merged PR throughput
- [`app/routes/$orgSlug/throughput/deployed/+functions/queries.server.ts`](../../app/routes/$orgSlug/throughput/deployed/+functions/queries.server.ts) — deployed PR throughput
- [`app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts`](../../app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts) — レビューメトリクス
- [`app/routes/$orgSlug/analysis/inventory/+functions/queries.server.ts`](../../app/routes/$orgSlug/analysis/inventory/+functions/queries.server.ts) — インベントリ
- [`app/routes/$orgSlug/analysis/feedbacks/_index/+functions/queries.server.ts`](../../app/routes/$orgSlug/analysis/feedbacks/_index/+functions/queries.server.ts) — feedback 集計

適用対象外の経路:

- [`app/routes/$orgSlug/settings/data-management/+functions/build-export-data.server.ts`](../../app/routes/$orgSlug/settings/data-management/+functions/build-export-data.server.ts) の `iterateExportRows` — raw export (生データ正本)
- [`batch/db/queries.ts`](../../batch/db/queries.ts) の `getPullRequestReport` — batch report (Google Sheets 連携)
- [`batch/usecases/classify-pull-requests.ts`](../../batch/usecases/classify-pull-requests.ts) の `classifyPullRequests` — LLM 分類
- [`app/routes/$orgSlug/settings/repositories/$repository/_index/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories/$repository/_index/queries.server.ts) — repository 詳細の PR 一覧 (運用者向け)
- [`app/routes/$orgSlug/settings/repositories/$repository/$pull/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories/$repository/$pull/queries.server.ts) — 単独 PR 詳細

### org-scoped キャッシュ

[`app/services/cache.server.ts`](../../app/services/cache.server.ts) に `getOrgCachedData` (5 分 TTL, 2 層 Map) と `clearOrgCache` がある。analysis / inventory 系 loader は既にこれを利用しており、フィルタ変更時は `clearOrgCache(organizationId)` を呼ばないと古い集計が最大 5 分残る。

[`app/routes/$orgSlug/settings/repositories.add/index.tsx`](../../app/routes/$orgSlug/settings/repositories.add/index.tsx) (L241 付近) に既存の `clearOrgCache` 呼び出しパターンがある。

### 既存の横断フィルタパターン

[`app/libs/tenant-query.server.ts`](../../app/libs/tenant-query.server.ts) の `excludeBots` が ExpressionBuilder を返す関数形式。各 query で `where(excludeBots)` として挿入する。本 issue の title filter も同じ流儀に乗せる。

### 認可 middleware

- [`app/routes/$orgSlug/_layout.tsx`](../../app/routes/$orgSlug/_layout.tsx) は [`orgMemberMiddleware`](../../app/middleware/org-member.ts) — member 以上
- [`app/routes/$orgSlug/settings/_layout.tsx`](../../app/routes/$orgSlug/settings/_layout.tsx) は [`orgAdminMiddleware`](../../app/middleware/org-admin.ts) — admin (owner | admin role) 以上
- role 判定は [`app/libs/member-role.ts`](../../app/libs/member-role.ts) の `isOrgAdmin` / `isOrgOwner`

## 設計判断

### 1. スコープは org 単位に限定する。team 拡張は本 issue 外

結論: フィルタは org 単位で保存する。将来の team 単位オーバーライドは本 issue では実装しない。また「team 拡張は additive」とは主張せず、unique key の migration が必要だと明記する。

理由:

- 現時点で team 単位の要望は発生していない。team オーバーライドは UI 編集対象も複雑化する
- 将来 team 拡張を入れる際は `UNIQUE (normalized_pattern)` を `UNIQUE (team_id, normalized_pattern)` へ migration する必要がある。`team_id NULL` で既存 row を保持する設計にはできるが、現状 schema を「完全に additive」と呼ぶには不正確なので、そう主張しない

### 2. 除外は動的フィルタで表現し、PR 側にフラグを持たない

結論: フィルタは `pr_title_filters` テーブルのみを正本にし、各 query 実行時に title を照合して除外する。`pullRequests` 側に `excluded_by_filter` のような列は持たない。

理由:

- フィルタ追加/削除/有効無効トグルが即座に全ビューに反映されるべき (UX 要件)
- PR にフラグを持たせる方式だと、フィルタ編集のたびに全 PR の再評価が必要で、更新コストとタイミングが複雑
- tenant DB の PR 件数規模 (数千〜1 万オーダー) では動的評価で問題にならない

### 3. マッチ実装は `instr()` で literal substring、`normalized_pattern` で保持する

結論:

- マッチは SQL の `LIKE` ではなく `instr(lower(title), normalized_pattern) > 0` を使う
- パターンは `pattern` (表示用) と `normalized_pattern` (trim + lowercase、マッチおよび unique 判定用) の 2 列で保持する
- 入力バリデーション: `trim` 後の長さ 2 文字以上 200 文字以下、純空白拒否

理由:

- `LIKE '%...%'` は `%` `_` がワイルドカードとして解釈される。ユーザー入力に `%` が含まれていれば全タイトルにマッチし、**1 件の誤入力で全ビューから PR が消えてメトリクスが壊れる**。これは Critical リスクなので実装レベルで避ける
- `instr()` は literal substring のみ評価するのでワイルドカード問題が発生しない
- `normalized_pattern` を保持することで `[WIP]` / `[wip]` / `[WIP]` のような表記ゆれを DB unique 制約で一本化できる。UI での警告だけでは競合 insert を防げない
- `trim` 後の最小長 2 は、空文字や単一記号 (`[`) のような「ほぼ全 PR にマッチ」する入力を防ぐため

### 4. 適用対象は display UI のみ。export / batch / classify は対象外

結論: フィルタは「Web UI で PR を可視化する query」だけに適用する。以下は対象外と明言する:

- raw data export ([`build-export-data.server.ts`](../../app/routes/$orgSlug/settings/data-management/+functions/build-export-data.server.ts))
- batch report ([`batch/db/queries.ts`](../../batch/db/queries.ts) の `getPullRequestReport`)
- LLM 分類 ([`batch/usecases/classify-pull-requests.ts`](../../batch/usecases/classify-pull-requests.ts))
- repository 詳細の PR 一覧 / 単独 PR ページ (運用者が直接指定しているため)

理由:

- raw export と batch report は「取得したデータの正本」を下流に渡す役割で、表示フィルタを混ぜると下流 (Google Sheets 等) でノイズ除去しているかが判別不能になる
- classify は機械学習の訓練・推論に使うデータで、人間の表示嗜好を混ぜると二次的バイアスが入る
- 直接指定ページはユーザーが意図して PR を開いているので除外する理由がない

対象 UI:

- Review Stacks / workload 系
- Throughput (ongoing / merged / deployed)
- Analysis (reviews / inventory / feedbacks)

### 5. 「今だけ全部表示」トグルは各ビューのヘッダに置く

結論: 各対象ビューのヘッダに「除外 PR も表示」トグルを置き、URL query param (`?showFiltered=1`) で表現する。トグル切替時は既存の query (`from`, `to`, `businessDays`, `period`, `excludeBots`, `team` など) を保持する。

理由:

- 透明性の担保: ユーザーは「フィルタが効いてるな」と確信できないと安心できない
- リロード耐性と共有可能性: URL 反映で `この状態の URL を貼る` ができる
- 既存検索条件保持: 単純リンクだと閲覧文脈を失う

### 6. 編集 UI は Sheet (admin のみ trigger) + 設定画面 (admin-only) の 2 層

結論:

- **Sheet (インライン)**: 各 PR 行から「タイトルパターンで除外」メニュー → 右スライドの Sheet。候補チップ + 自由入力 + プレビュー
- **設定画面** (`/$orgSlug/settings/pr-filters`): パターン一覧・有効無効トグル・削除・編集

Sheet trigger と設定画面の両方とも admin 以上のみ表示・操作できる。非 admin (member) にはバナー (情報表示) のみ見える。

理由:

- フィルタは org-wide metrics を即時に変える設定であり、member が自由に編集すると他メンバーの数字が変わる。これは admin 操作相当
- 設定画面側は既に [`orgAdminMiddleware`](../../app/middleware/org-admin.ts) で保護されている。Sheet から送信する fetcher も同じ route / middleware 配下に置く
- 非 admin にフィルタ操作 UI を見せない (discoverability 制御) ことで、ボタンを押したら 403 という不満体験を避ける
- CLAUDE.md の「Auth guard first」原則に従い、parseWithZod より前に authorization を完了させる

### 7. 候補自動抽出ルール

PR タイトルから以下を候補として提示する:

- `[...]` ブロックをそのまま抽出 (例: `[DO NOT MERGE]`, `[EPIC-123]`)
- `[EPIC-` のような「ブラケット内の英字プレフィックス」まで段階化 (具体番号 `[EPIC-123]` と汎化 `[EPIC-` の両方を候補に出す)
- 行頭の `XXX:` 形式プレフィックス (例: `WIP:`, `Draft:`)

自由入力も常に可能。各候補には「現在マッチする件数」を即表示する (母集団は次項で定義)。

### 8. プレビューのデータソースは lazy load、母集団を明示する

結論:

- Sheet 用の「直近 90 日の PR タイトル一覧」は Sheet open 時に resource route (`/$orgSlug/resources/pr-titles-recent`) から lazy fetch する
- ビューの loader で事前ロードしない (Sheet を開かない通常閲覧に余分な payload を背負わせない)
- 件数の母集団は次で定義する:
  - **バナーの「N 件除外中」**: そのビューの現在のフィルタコンテキスト (team, period, date range) 内でマッチした PR のうち、enabled フィルタにより除外された件数
  - **Sheet の候補横の件数 / プレビュー件数**: org 全体の直近 90 日 PR のうち、編集中パターンにマッチする件数 (view context 非依存)

理由:

- バナーはそのビューの数字に対して「フィルタが影響していること」を示すのが目的なので、view context 内の件数が正しい
- Sheet プレビューは「このパターンを追加すると、組織全体でどれくらいの PR が除外されるか」を見せるのが目的なので、view context からは独立させる
- 母集団が異なることを UI コピーで明示する (例: バナーは `現在のビューで N 件除外中`、Sheet は `組織全体 / 直近 90 日で N 件`)

非採用案:

- 毎キー入力で `/api/pr-filter-preview?pattern=...` を叩く: レイテンシと API 負荷
- 全期間を一括ロード: 組織によっては数万件、初回描画が重くなる

### 9. フィルタ変更時は org cache を無効化し、cache key に `showFiltered` を含める

結論:

- フィルタの create / update / delete / toggle を行う全 mutation の最後で `clearOrgCache(organizationId)` を呼ぶ
- `getOrgCachedData` を使う loader の cache key には `showFiltered` bool (`'f'` / `'t'`) を含める。例: `review-metrics:team=${teamId}:period=${period}:sf=${showFiltered ? 't' : 'f'}`
- フィルタ `pattern` 自体は key に含めない。pattern 変更時は `clearOrgCache` で全消しされるため

理由:

- analysis / reviews / inventory 系 loader は [`getOrgCachedData`](../../app/services/cache.server.ts) を 5 分 TTL で使っている (feedbacks は現状 cache 未使用なのでこの節の対象外)
- `showFiltered` を key に含めないと、先に filtered 結果が cached された後、`?showFiltered=1` で unfiltered を要求しても古い filtered cache が返り、要件 10 (トグルで全 PR 表示) が壊れる
- 既に [`app/routes/$orgSlug/settings/repositories.add/index.tsx`](../../app/routes/$orgSlug/settings/repositories.add/index.tsx) で admin mutation 後の `clearOrgCache` パターンが確立している
- pattern を key に含めると key 多重化でメモリ圧を生むため、pattern 変更は `clearOrgCache` に任せる。結果として `showFiltered` 2 値分 (`'f'` / `'t'`) のキャッシュのみ保持する

補足: `clearOrgCache` は process-local な `Map` を消すため、本番が複数 web process / instance で動く場合は他 instance の cache が即時無効化されない。現状 upflow は単一プロセスで稼働している前提で設計しているが、将来 scale out する際は共有 invalidation 手段 (Redis pub/sub 等) を検討する TODO として残す。

### 10. 削除は ConfirmDialog パターン、復元は本 issue では実装しない

結論:

- 削除操作は CLAUDE.md の ConfirmDialog 連携パターン (`confirm-delete` → `delete` の 2-step intent) を使う
- ソフト削除 (`deleted_at`) や 7 日復元機能は本 issue では実装しない

理由:

- org-wide metrics を即時変える設定なので、誤削除の影響はバナー上は戻せるが「消えたパターン文字列」は思い出せない
- ConfirmDialog は既存 `/settings/teams._index/index.tsx` 等で採用済みの標準パターン
- ソフト削除を入れると一覧 UI と unique 制約の扱いが複雑化するので、まず実用上の確認ステップで誤削除を防ぐ

### 11. 監査情報は `created_by` / `updated_by` で保持する。UI 表示は shared DB user lookup で解決する

結論:

- `pr_title_filters` に `created_by TEXT NOT NULL` と `updated_by TEXT NOT NULL` を持たせる。値は mutation 実行時の `session.user.id`
- 設定画面の loader で、一覧に出現する `created_by` / `updated_by` の user id 集合を shared DB `users` テーブルから一括 lookup し、`{ id, name, email }` の map を作って UI に渡す
- lookup 結果に該当 id が見つからない (user 削除済み) 場合は `(deleted user)` を fallback 表示する

理由:

- フィルタ変更は過去メトリクスの見え方を変える高影響操作なので、「誰が追加・変更したか」が後から分かる必要がある
- tenant DB に `users` は無く shared DB にあるため、表示時に lookup が必要
- 既存の [`github_app_link_events`](../../app/services/github-app-link-events.server.ts) のような append-only audit log は、本 issue のスケール (年数回〜数十回程度の編集) にはオーバーキル
- 削除済み user の fallback を持たないと「Last edited by undefined」等の表示崩れが発生する

## 要件

### 機能要件

1. org 単位に PR タイトル除外パターンを複数登録できる。
2. パターンは `instr()` ベースの部分一致 (case-insensitive, literal substring) でマッチし、マッチした PR は対象ビューから除外される。
3. パターン入力は `trim` 後 2 文字以上 200 文字以下に制限される。純空白、空文字は拒否される。`%` や `_` などワイルドカードメタ文字は literal として扱われる。
4. `normalized_pattern` (trim + lowercase) による重複登録が防止され、`[WIP]` と `[wip]` は同一として扱われる。
5. パターンは個別に enabled / disabled をトグルでき、無効化したパターンは即座にフィルタから外れる。
6. Review Stacks / workload / throughput (ongoing/merged/deployed) / analysis (reviews/inventory/feedbacks) のすべてで同じフィルタが適用される。
7. raw export / batch report / LLM 分類 / repository 詳細 / 単独 PR ページはフィルタ影響を受けない。
8. フィルタの create / update / delete / toggle 後は `clearOrgCache(organizationId)` が呼ばれ、キャッシュされた集計も即時に新しい状態を反映する。
9. 各対象ビューのヘッダに「現在のビューで N 件除外中」バナーが表示され、クリックで設定画面へ遷移できる (admin のみ)。member にはバナーは情報表示として見えるが、リンクは辿れない (または無表示)。
10. 各対象ビューは URL query `?showFiltered=1` で一時的にフィルタを無効化して全 PR を表示できる。トグル操作時は既存の他 query params をすべて保持する。
11. admin 以上のユーザーのみ PR 行から Sheet trigger (`⋯` → `タイトルパターンで除外`) が見える。Sheet は Review Stacks (`app/routes/$orgSlug/workload/index.tsx`) に Phase 1 で設置する。throughput / analysis への展開は Phase 2。
12. Sheet ではタイトルから自動抽出した候補チップ (`[...]` / `[PREFIX-` / `PREFIX:`) が表示され、各候補横に「組織全体 / 直近 90 日で N 件マッチ」を表示する。
13. Sheet の自由入力フィールドは入力ごとにマッチ件数とプレビューリスト (上位 20 件) を即更新する。入力バリデーション違反時は保存ボタンが無効化される。
14. Sheet のプレビュー用タイトルは Sheet open 時に resource route (`/$orgSlug/resources/pr-titles-recent`) 経由で lazy fetch する。通常閲覧時の loader payload に含めない。resource route は `orgAdminMiddleware` で保護され、member からの GET は redirect される。
15. 設定画面 (`/$orgSlug/settings/pr-filters`) は admin のみアクセスでき、パターンの追加・編集・削除・有効無効トグルができる。
16. 設定画面の編集時も Sheet と同じプレビュー (件数 + 上位 20 件リスト) を表示する。
17. 削除操作は ConfirmDialog (`confirm-delete` → `delete` の 2 段 intent) で確認を要求する。
18. 設定画面で各パターンの `Created by` / `Last edited by` / `Updated at` が表示される。

### 非機能要件

1. multi-tenant 規約に従い、すべての mutation で server-derived な `organizationId` を使い、form 由来の値を信用しない。loader / action の authorization は `parseWithZod` より前に完了させる。
2. query 実行時の tenant scoping は `getTenantDb(organizationId)` で担保する (tenant DB は org スコープのため追加 `WHERE organizationId` は不要)。
3. フィルタ評価は SQLite レベルで実行し、アプリケーション層で PR 一覧を持ち回ってから filter することはしない (メトリクス計算を重くしないため)。
4. `instr()` を使うためパターンマッチにインデックスは効かない。tenant DB の PR 件数が 10,000 件を超える場合は本番データでベンチマークし、必要なら FTS5 導入を検討する (受け入れ条件に計測ポイントを含める)。
5. バナー用の `excludedCount` は filtered / unfiltered の 2 回 count で算出する。各 loader でクエリが 1 回増えることを許容する前提とする。
6. 新規・更新する `created_at` / `updated_at` は ISO 8601 UTC (`...Z`) を使う。
7. Sheet trigger と設定画面の表示判定は loader から `isAdmin` bool を返し、コンポーネント側で条件レンダリングする。server-side の action / fetcher route も `orgAdminMiddleware` で保護する。
8. UI コピーは Phase 1 では英語固定 (既存 settings 画面と揃える)。将来 `organizationSettings.language` 連動する場合は別 issue。

## スキーマ変更

### 1. tenant DB `pr_title_filters` 新規追加

対象: [`db/tenant.sql`](../../db/tenant.sql)

```sql
CREATE TABLE `pr_title_filters` (
  `id` text NOT NULL,
  `pattern` text NOT NULL,
  `normalized_pattern` text NOT NULL,
  `is_enabled` integer NOT NULL DEFAULT 1,
  `created_by` text NOT NULL,
  `updated_by` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (`id`)
);
CREATE UNIQUE INDEX `pr_title_filters_normalized_pattern_key` ON `pr_title_filters` (`normalized_pattern`);
CREATE INDEX `pr_title_filters_is_enabled_idx` ON `pr_title_filters` (`is_enabled`);
```

設計メモ:

- `pattern` は入力のまま保存 (表示用)
- `normalized_pattern` は `trim` + `toLowerCase` した結果を保存。マッチと unique 判定の正本
- `UNIQUE (normalized_pattern)` で表記ゆれ含めた重複登録を防ぐ
- `is_enabled` は toggle 用。`INDEX` を張るほどの規模ではないがコスト微々たるものなので張る
- `created_by` / `updated_by` は shared DB の `users.id` を参照する論理 FK。tenant DB と shared DB は別ストアのため FK 制約は付けない
- 将来 team スコープ拡張時は `team_id TEXT NULL` 追加 + `UNIQUE` を `(team_id, normalized_pattern)` に migrate する (本 issue 外)
- 将来 regex / prefix 区別が欲しくなったら `match_type TEXT NOT NULL DEFAULT 'substring'` を追加する

migration は tenant DB migration として `db/migrations/tenant/` に追加する。

## アプリケーション変更

### 1. query / mutation 層

新規ファイル:

- `app/services/pr-title-filter-queries.server.ts`
  - `listPrTitleFilters(organizationId)` — 一覧 (有効無効両方、`created_at` 昇順)
  - `listEnabledPrTitleFilters(organizationId)` — `is_enabled=1` のみ。query 組み込み用。結果は `{ id, pattern, normalizedPattern }[]`
  - `listRecentPullRequestTitles(organizationId, sinceDays=90)` — Sheet プレビュー用タイトル一覧 (Sheet 側は lazy fetch)
- `app/services/pr-title-filter-mutations.server.ts`
  - `createPrTitleFilter(organizationId, { pattern, isEnabled, userId })` — `normalized_pattern` は service 層で計算して insert
  - `updatePrTitleFilter(organizationId, id, { pattern?, isEnabled?, userId })` — `pattern` 変更時は `normalized_pattern` も再計算
  - `deletePrTitleFilter(organizationId, id)` — hard delete
  - 全 mutation の末尾で `clearOrgCache(organizationId)` を呼ぶ

既存ファイル追加:

- [`app/libs/tenant-query.server.ts`](../../app/libs/tenant-query.server.ts) に `excludePrTitleFilters(normalizedPatterns: string[])` を追加
  - `excludeBots` と同じ ExpressionBuilder 形式
  - 空配列のときは `eb.lit(true)` 相当を返して no-op
  - 各 `normalizedPattern` ごとに `eb(eb.fn('instr', [eb.fn('lower', ['pullRequests.title']), eb.val(normalizedPattern)]), '=', 0)` を AND で畳む (0 は「含まれない」を意味する)
  - Kysely の `eb.and([...])` で組み立てる

入力バリデーション:

- `app/libs/pr-title-filter.ts` (クライアント / サーバー共有) に `normalizePattern()` と Zod schema を置く
- Zod schema: `z.string().trim().min(2).max(200).refine((s) => s.trim().length >= 2, 'pattern must contain non-whitespace')`
- `normalizePattern(input)` = `input.trim().toLowerCase()`
- 候補自動抽出 `extractPatternCandidates(title)` も同ファイルに置き、Sheet と server fallback で共有する

### 2. 対象 query への組み込み

対象ファイル (全 `pullRequests` を from にしている UI query):

- [`app/routes/$orgSlug/workload/+functions/stacks.server.ts`](../../app/routes/$orgSlug/workload/+functions/stacks.server.ts)
- [`app/routes/$orgSlug/workload/$login/+functions/queries.server.ts`](../../app/routes/$orgSlug/workload/$login/+functions/queries.server.ts)
- [`app/routes/$orgSlug/throughput/ongoing/+functions/queries.server.ts`](../../app/routes/$orgSlug/throughput/ongoing/+functions/queries.server.ts)
- [`app/routes/$orgSlug/throughput/merged/+functions/queries.server.ts`](../../app/routes/$orgSlug/throughput/merged/+functions/queries.server.ts)
- [`app/routes/$orgSlug/throughput/deployed/+functions/queries.server.ts`](../../app/routes/$orgSlug/throughput/deployed/+functions/queries.server.ts)
- [`app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts`](../../app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts)
- [`app/routes/$orgSlug/analysis/inventory/+functions/queries.server.ts`](../../app/routes/$orgSlug/analysis/inventory/+functions/queries.server.ts)
- [`app/routes/$orgSlug/analysis/feedbacks/_index/+functions/queries.server.ts`](../../app/routes/$orgSlug/analysis/feedbacks/_index/+functions/queries.server.ts)

各 query の loader は以下を行う:

1. `URL` から `showFiltered` query param を読む
2. `showFiltered === '1'` でなければ `listEnabledPrTitleFilters(organizationId)` を呼んで `normalizedPatterns` を取得
3. pattern list を query に `.where(excludePrTitleFilters(normalizedPatterns))` として渡す
4. バナー用に `excludedCount` と `filterActive` を計算し loader 戻り値に含める
5. `filterActive` は `showFiltered !== '1' && normalizedPatterns.length > 0` の bool
6. loader 戻り値に `isAdmin` (bool, `isOrgAdmin(membership.role)` 由来) も含める

`excludedCount` の定義 (画面ごと):

- Review Stacks / workload / throughput (ongoing/merged/deployed) / analysis/inventory / analysis/feedbacks: そのビューで表示対象となる distinct PR 件数の差分 (unfiltered total - filtered total, view context 内)
- **analysis/reviews (Review Bottleneck)**: queue history / wip cycle / PR size の 3 系列を扱うが、`excludedCount` は **wipCycleRaw の distinct PR 数** の差分で統一する。理由: wip cycle が open PR の PR 単位リストで、フィルタの直接影響対象として最もユーザーに伝わりやすい

count 実装:

- count は各 query の既存集計と別に 2 回走る (with filter / without filter)
- 既存の filter (period, team 等) は両方にかける
- 二重 count の性能は tenant PR 件数が 10,000 件以下なら許容、超えたら計測して対応を決める

キャッシュ整合:

- `getOrgCachedData` を使う loader ([`app/routes/$orgSlug/analysis/reviews/index.tsx`](../../app/routes/$orgSlug/analysis/reviews/index.tsx), [`app/routes/$orgSlug/analysis/inventory/index.tsx`](../../app/routes/$orgSlug/analysis/inventory/index.tsx)) は cache key に `showFiltered` の bool (`'f'` / `'t'`) を含める。feedbacks は cache 未使用なので対象外
- pattern 自体は key に含めない。pattern 変更は mutation 末尾の `clearOrgCache` に任せる
- これにより、`?showFiltered=1` 切替時に古い filtered cache が返る事故を防ぎつつ、pattern 多重化でメモリ圧を生まない

clientLoader 透過ルール:

- [`app/routes/$orgSlug/workload/index.tsx`](../../app/routes/$orgSlug/workload/index.tsx) の `clientLoader` は現状 `{ teamStacks }` だけを返して `excludedCount` / `filterActive` / `isAdmin` を落とす設計。本 issue では clientLoader が serverLoader の戻り値から banner / admin 関連フィールド (`excludedCount`, `filterActive`, `showFiltered`, `isAdmin`) を必ず透過するように改修する
- 同じ方針を [`app/routes/$orgSlug/analysis/reviews/index.tsx`](../../app/routes/$orgSlug/analysis/reviews/index.tsx), [`app/routes/$orgSlug/analysis/inventory/index.tsx`](../../app/routes/$orgSlug/analysis/inventory/index.tsx) にも適用する

Phase 1 Review Stacks の row trigger に必要なデータ:

- Sheet trigger が必要とするのは **PR タイトル文字列のみ** (候補自動抽出の種として使うだけ)。フィルタは org-wide で適用されるため `repositoryId` や `number` を trigger 起動時に渡す必要はない
- 現行 [`aggregate-stacks.ts`](../../app/routes/$orgSlug/workload/+functions/aggregate-stacks.ts) の `StackPR` は `title` を既に保持しているので追加フィールドは不要
- PR 行コンポーネント [`pr-block.tsx`](../../app/routes/$orgSlug/+components/pr-block.tsx) および [`team-stacks-chart.tsx`](../../app/routes/$orgSlug/workload/+components/team-stacks-chart.tsx) に `⋯` メニューを追加し、`StackPR.title` を Sheet コンポーネントに渡す
- 将来 Phase 2 で throughput / analysis に展開するときも同様に title のみで足りる

### 3. 設定画面 route

新規:

- `app/routes/$orgSlug/settings/pr-filters/_index/index.tsx` — 一覧、追加、編集、削除、有効無効トグル
- `app/routes/$orgSlug/settings/pr-filters/_index/+functions/queries.server.ts`
- `app/routes/$orgSlug/settings/pr-filters/_index/+functions/mutations.server.ts`

action は discriminated union schema + ts-pattern match:

- `intent: 'create'` — 新規追加
- `intent: 'update'` — `id`, `pattern`, `isEnabled`
- `intent: 'toggle'` — `id`, `isEnabled`
- `intent: 'confirm-delete'` — ConfirmDialog を開く (`shouldConfirm: true`)
- `intent: 'delete'` — 実行
- error 返却は `getErrorMessage(e)` + `submission.reply({ formErrors: [...] })`

authorization は `settings/_layout.tsx` の `orgAdminMiddleware` で担保される。追加の guard は不要だが、action 冒頭で `requireOrgMember` 結果の role を確認するルートパターンに揃えるため `isOrgAdmin(membership.role)` を parseWithZod 前に検査する。

sidebar nav ([`app/routes/$orgSlug/settings/_layout.tsx`](../../app/routes/$orgSlug/settings/_layout.tsx)) に「PR Filters」エントリを追加し、breadcrumb handle も設定する。

### 4. Sheet コンポーネントと lazy fetch resource route

新規 resource route:

- `app/routes/$orgSlug/resources/pr-titles-recent.ts` — GET only
  - query: `days` (default 90, max 180)
  - 戻り値: `{ titles: { repositoryId: string, number: number, title: string }[] }`
  - stable key は client 側で `` `${repositoryId}:${number}` `` を使う (tenant `pull_requests` は `(number, repository_id)` 複合主キーで `id` 列を持たないため)
  - パスは `$orgSlug` 配下のため上位 layout では `orgMemberMiddleware` のみ。resource route 自身の `middleware` に `orgAdminMiddleware` を明示的に設定する (Sheet trigger は admin のみ起動するため)
  - response は Cache-Control: no-store (フィルタ編集中の最新値が必要)

新規共有コンポーネント:

- `app/routes/$orgSlug/+components/pr-title-filter-sheet.tsx`
  - props: `pullRequestTitle?: string` (inline 起動時に自動抽出の種)
  - shadcn/ui の `Sheet` を使う
  - `useFetcher()` で resource route からタイトル一覧を lazy fetch (`useEffect` で open 時に 1 回)
  - 候補チップは `extractPatternCandidates(title)` で生成
  - プレビュー件数は client 側で `titles.filter(t => t.toLowerCase().includes(normalizedPattern)).length`
  - submit は `useFetcher()` で `/$orgSlug/settings/pr-filters` の action に向けて POST
  - 非 admin にはそもそも trigger が見えないため、Sheet 自体 non-admin 環境では起動しない
  - submit 成功後 Sheet は自動 close、loader 再実行で背景ビューの PR 一覧も更新される

trigger の設置:

- Phase 1: Review Stacks のみ ([`app/routes/$orgSlug/workload/index.tsx`](../../app/routes/$orgSlug/workload/index.tsx)) の PR 行に `⋯` メニュー → admin のみ
- Phase 2 (別 PR): throughput 3 画面 / analysis 3 画面の PR 一覧にも展開
- `pr-drill-down-sheet.tsx` のような既存 drill-down UI への組み込みは Phase 2 で判断

### 5. バナーコンポーネント

新規: `app/routes/$orgSlug/+components/pr-title-filter-banner.tsx`

- props: `excludedCount: number`, `filterActive: boolean`, `showFiltered: boolean`, `isAdmin: boolean`, `currentSearchParams: URLSearchParams`
- 表示パターン:
  - `showFiltered === true`: 「フィルタを無効化中。[元に戻す]」(リンクは `showFiltered` を削除した同一 URL)
  - `filterActive && excludedCount > 0`: 「現在のビューで N 件が除外されています。[すべて表示] [設定]」
    - [すべて表示] は既存 query を保持して `showFiltered=1` を追加
    - [設定] は admin のみ表示、`/settings/pr-filters` へ
  - `filterActive && excludedCount === 0`: 非表示 (うるさくしない)
  - `!filterActive`: 非表示
- 既存 query params は `new URLSearchParams(currentSearchParams)` でコピーして編集するヘルパーを使う

### 6. 適用対象外の明示

以下の query は本 issue では変更しない旨をコードコメントおよび RDD で明示:

- [`app/routes/$orgSlug/settings/data-management/+functions/build-export-data.server.ts`](../../app/routes/$orgSlug/settings/data-management/+functions/build-export-data.server.ts) の `iterateExportRows`
- [`batch/db/queries.ts`](../../batch/db/queries.ts) の `getPullRequestReport`
- [`batch/usecases/classify-pull-requests.ts`](../../batch/usecases/classify-pull-requests.ts) の `classifyPullRequests`
- repository 詳細の PR 一覧 / 単独 PR ページ

## 移行方針

新規機能のため migration は追加のみ。rollout は phased で行う。

### Phase 1: schema 追加

1. tenant DB migration で `pr_title_filters` table を追加する
2. reader / writer コードはまだ deploy しない
3. この時点では既存 org のビューは従来通り全 PR を表示する

### Phase 2: reader deploy (no-op)

1. `excludePrTitleFilters` と `listEnabledPrTitleFilters` を deploy
2. 各対象 query loader に組み込む (この時点では DB にパターン 0 件なので動作変化なし)
3. バナーコンポーネントも deploy (`excludedCount=0` なので非表示)

### Phase 3: writer deploy + UI 開示

1. 設定画面と Sheet を deploy
2. sidebar nav に「PR Filters」エントリ追加
3. admin が初めてパターンを登録した時点でフィルタが有効化される

### Phase 4 (別 PR): 対象ビュー拡張

1. Sheet trigger を throughput / analysis に展開

### Rollback 手順

ロールバックは「UI hide → writer 凍結 → reader kill → schema drop」の順で進める。中間で止めれば機能停止は達成できるため、DB drop は最終手段。

1. **UI hide** (Phase 4 の revert): Sheet trigger の設置箇所を revert し、機能への入口を減らす
2. **writer 凍結** (Phase 3 の revert): 設定画面の新規登録 / 編集 / 削除 action を 503 で返す or writer route 自体を revert。既存パターンは DB に残るが追加・変更を止める
3. **reader kill** (Phase 2 の revert): reader code (各 loader の `excludePrTitleFilters` 呼び出しと banner 計算) を revert するか、emergency hatch として shared DB feature flag を追加しておき無効化する
4. **緊急時の一括無効化**: reader revert が間に合わない場合の stopgap として tenant DB に `UPDATE pr_title_filters SET is_enabled = 0` を流す。これで table は残したままフィルタを全 OFF にできる。**必ず合わせて** process restart または `clearAllCache()` 相当の cache 全消去を実行する (`getOrgCachedData` は process-local Map で 5 分 TTL を持つため、SQL だけでは最大 5 分間 filtered 結果が残る)
5. **schema drop**: reader / writer が両方戻った後にのみ `DROP TABLE pr_title_filters` を実行する。reader が生きた状態で drop すると loader がクエリ失敗するため順序を守る

Phase ごとの安全に DROP 可能な条件:

- **Phase 1 (schema のみ deploy)**: reader 未デプロイなので DROP TABLE のみで安全に戻せる
- **Phase 2 以降 (reader deploy 済み)**: reader を revert (or 無効化) するまで DROP TABLE 不可。reader が生きた状態で drop すると対象 loader が全て 500 になる。必ず上記 3 (reader kill) を完了してから DROP する

## 受け入れ条件

### schema / 基本動作

1. tenant DB migration 適用後、`pr_title_filters` table が存在し、`pnpm db:setup` が成功する。
2. `pr_title_filters` は `UNIQUE (normalized_pattern)` を持ち、`[WIP]` と `[wip]` (前後空白) は重複登録できない。
3. `/settings/pr-filters` で pattern を追加するとリストに表示され、`created_by` / `updated_by` に実行ユーザーの ID が保存される。

### マッチ動作

4. Review Stacks で `[DO NOT MERGE]` タイトルの PR が少なくとも 1 件ある状態で `[DO NOT MERGE]` を enabled で登録すると、その PR が一覧から消え、バナーに「現在のビューで 1 件除外中」が表示される。
5. 同じ状態で URL に `?showFiltered=1` を付けてリロードすると、除外された PR が再び表示され、バナーが「フィルタを無効化中」に変わる。`showFiltered` トグルのリンクは既存 `team` / `from` / `to` などの query を保持する。
6. 登録済み pattern を disabled にすると、即座に対象ビューから除外が解除される (キャッシュ経由でも)。
7. `[DO NOT MERGE]` と `[do not merge]` は case-insensitive で同じ PR にマッチする。

### 入力バリデーション (Critical)

8. `%` を含む pattern (`100%`) を登録しても `%` はワイルドカードとして扱われず、literal `100%` を含むタイトルのみマッチする。
9. `_` を含む pattern (`PR_123`) も literal として扱われ、`PR1X23` のような任意 1 文字マッチにはならない。
10. 空文字、純空白 (`   `)、1 文字 pattern (`[`) は登録 action が 400 で拒否し、DB に row が作成されない。

### キャッシュ無効化 (Critical)

11. analysis/reviews および analysis/inventory loader (`getOrgCachedData` 利用) が 1 回アクセスされた直後にフィルタ mutation を実行すると、次のアクセスで即座に新しいフィルタ結果が反映される (5 分 TTL を待たない)。
    11b. 同 loader が filtered 状態で 1 回 cached された後、`?showFiltered=1` を付けてアクセスすると、古い filtered cache ではなく unfiltered 結果が返る (cache key に `showFiltered` が含まれていることの担保)。

### 適用対象外の検証

12. raw export (`/settings/data-management` の export), batch report (`pnpm tsx batch/cli.ts report`), LLM 分類 (`classify`), repository 詳細 PR 一覧はフィルタの影響を受けず、除外対象 PR もそのまま出力される。

### 権限境界

13. member ロールでログインしたユーザーには PR 行の Sheet trigger が表示されない。`/settings/pr-filters` にアクセスすると orgAdminMiddleware により redirect される。
14. member に見えるバナーは情報表示のみで、[設定] リンクは表示されない (または admin のみ有効)。
15. action route への direct POST を member セッションで試みると `orgAdminMiddleware` により redirect (3xx) が返り、DB 状態は変化しない。現行 middleware の挙動 (redirect) に合わせる。明示的な 403 応答を返したい場合は action 内で追加の guard を入れる別 issue として切る。

### UI 動作

16. Review Stacks の PR 行 ⋯ メニューから「タイトルパターンで除外」を選ぶと Sheet が開き、その PR のタイトルから `[DO NOT MERGE]` などの候補チップが自動抽出される。候補横には「組織全体 / 直近 90 日で N 件マッチ」と表示される。
17. Sheet の自由入力でタイプするたびにマッチ件数とプレビューリスト (上位 20 件) が client 側で更新され、サーバー往復は発生しない。
18. Sheet の submit 成功後、Sheet が自動 close し、background Review Stacks 一覧から該当 PR が消える (loader 再実行経由)。
19. 削除操作は ConfirmDialog を経由して行われ、確認せずに削除されない。
20. 設定画面で各パターンの `Created by` / `Last edited by` が表示される。user は shared DB `users` テーブルから name で解決され、該当 user が削除済みの場合は `(deleted user)` と表示される。
21. 設定画面の pattern 編集時にも Sheet と同じ形式のプレビュー (件数 + 上位 20 件リスト) が表示される。

### 母集団の定義

22. バナーの「N 件除外中」は現在のビューの team filter / period filter 等を反映した件数を表示する。
23. Sheet の候補横件数とプレビューは、ビューの filter に関係なく「組織全体 / 直近 90 日」の件数を表示する。

### ビュー網羅

24. Review Stacks (`/workload`)、個人 workload (`/workload/$login`)、throughput ongoing/merged/deployed (`/throughput/*`)、analysis reviews/inventory/feedbacks (`/analysis/*`) のすべてでフィルタが適用され、バナーが表示される。
25. trigger (Sheet 起動) は Phase 1 では Review Stacks のみで、他ビューでは表示されない。

### 性能 (計測メモ — 受け入れ条件ではなく検証手順)

26. 性能は自動 AC にせず、実装後に以下の計測メモを RDD 末尾に追記する形で検証する:
    - 対象 loader: Review Stacks (`workload`), Review Bottleneck (`analysis/reviews`), Inventory (`analysis/inventory`), throughput merged (週比較あり)
    - テストデータ: 現行 seed + 5,000 件規模の tenant DB dump を用意
    - 測定方法: loader を 10 回ずつ連続実行し、median を比較 (ウォームアップ 2 回は捨てる)
    - 判定: フィルタ導入前後で median 実行時間が 20% 以内の劣化に収まる
    - PR 件数が 10,000 件を超える組織が現れたら別 issue で FTS5 or インデックス戦略を再検討する

### マルチテナント隔離

27. 異なる org のフィルタは互いに影響しない (tenant DB scoping の担保)。

### validation

28. `pnpm validate` が通る。
29. `excludePrTitleFilters`、`normalizePattern`、`extractPatternCandidates`、設定画面の action 各 intent に対するユニットテストがある。

## リスク・補足

1. `instr()` ベースのマッチは全タイトルにフルスキャンが走るため、tenant PR 件数が 100,000 件オーダーになれば性能影響が出る可能性がある。本 issue の対象規模 (10,000 件以下) では問題ないが、計測ポイントを受け入れ条件 26 に置いた。
2. プレビュー用の `listRecentPullRequestTitles` は 90 日で切るが、古いタイトルパターンを除外したいケース (EPIC が 6 ヶ月開いている等) はプレビューに出ない。実 DB 側のフィルタは全期間適用されるので動作には影響しないが、Sheet のマッチ件数が過小表示になる。UI コピーで「直近 90 日」と明示することで誤解を避ける。
3. PR タイトルのみを対象にし、PR 本文 (body) や labels は対象外。GitHub の labels ベース除外は将来の別 issue として積む。
4. Sheet から追加した pattern も全 org 横断で適用される。他メンバーの画面にも即座に反映される点は Sheet 内の警告コピーで注意喚起する (例: `このパターンは組織全体のフィルタに追加されます`)。
5. `UNIQUE (normalized_pattern)` により表記ゆれ含めた重複は防げるが、上位概念 (`[EPIC-`) と下位具体 (`[EPIC-123]`) の共存は防げない。UI 側で「より広いパターンが既にあります」の warning は出すが、DB 制約にはしない。
6. `clearOrgCache` は org 全体のキャッシュを一括削除するため、フィルタ変更直後は他の loader も含めて再計算が走る。フィルタ編集頻度が低い前提なので許容する。
7. 監査要件が強化された場合 (誰がいつどのパターンを削除したかの時系列追跡など) は `github_app_link_events` と同様の append-only event log table を後続 issue で追加する。本 issue では `created_by` / `updated_by` のみ。

## Status

Implemented in #308, #316, #317
