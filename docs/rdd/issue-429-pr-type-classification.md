# PR を種別で分類して cycle time の対象範囲と意味を再定義する

<!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->

## 背景・課題

upflow が計測している `cycle time` は、現在 **すべての merged PR を同じ尺度** で扱っている。実テナントのデータで観察すると、PR には **「人間の作業時間」を測る意味が成立しない種別** が混在しており、これが集計を歪めている。

複数テナントの計測で確認:

- **テナント A** (約 4,200 件 merged PR、直近 12 ヶ月): release / template-merge は 1 件未満、dependency が約 16%。比較的健全
- **テナント B** (約 1,200 件): **release 約 18%、template-merge 約 2%、dependency 約 9%**。**約 29% が cycle time の対象外であるべき PR**

混入の典型例:

- **Release PR** (release-please 等の bot が自動生成): 即マージ、`coding_time` が前回 release 以降の全 commit を拾って数百日になる
- **Template merge PR** ("Merged X-template into Y-derived"): commit は他ブランチ由来、即マージなのに `coding_time` が 1000+ 日になる (closed issue #428 の議論で確認)
- **Dependency PR** (Renovate / Dependabot): 既に `excludeBots` で除外されているが、判定が author 一律で粒度が粗い

これらを「PR」という同じ箱に入れて中央値や上位 10% を出しても、診断画面 (issue #332 で再設計中) は意味のある順位を出せない。

加えて、closed issue #428 で議論した「firstCommittedAt 計算アーティファクト」は、種別分類で **大半が解消される** (release / template-merge / dependency を最初から対象外にすれば、それらに起因するアーティファクトは発生しない)。本 RDD は issue #428 のスコープを吸収する。

スコープ:

- 含む: PR 種別の **分類** と、種別ごとの **cycle time 対象範囲の定義**
- 含まない:
  - 種別を踏まえた **画面 UI の再設計** (別 RDD: issue #332 PR #426)
  - **手動 override 機構** (GitHub label 等) — Open Question に残す
  - **テナント別の signal カスタマイズ** (組織独自の `rel/*` ブランチ規約等への対応) — 本 RDD は **upflow 既知規約 (実テナント計測ベース) で固定** し、`organizationSettings` 等での可変化はしない。運用後にテナント差異が顕在化したら別 RDD でスキーマ拡張を扱う

## 現状実装の確認

### 既存の判別関連

- bot 判定は `app/libs/tenant-query.server.ts:9-19` の `excludeBots` で実装済 (`companyGithubUsers.type = 'Bot'`)
- PR title filter は `app/libs/pr-title-filter.server.ts` で実装済 (タイトルパターンで除外、ユーザー定義)
- `pull_requests` テーブルには `title` / `source_branch` / `target_branch` / `author` / `additions` / `deletions` / `complexity` 等が永続化されている (`db/tenant.sql:56-89`)
- `companyGithubUsers.type` は `'User'` / `'Bot'` / null の 3 値 (`db/tenant.sql:127-150`、`app/routes/$orgSlug/settings/github-users._index/index.tsx:120`)

### 既存の cycle time 計算

- `batch/bizlogic/cycletime.ts:9-110` で `codingTime` / `pickupTime` / `reviewTime` / `deployTime` / `totalTime` を計算
- `batch/github/pullrequest.ts:135` で `firstCommittedAt = artifacts.commits[0].date` (PR ブランチの最古 commit)
- `app/routes/$orgSlug/analysis/cycle-time/+functions/queries.server.ts:47, 96` で `excludeBots` を常時適用

### 既存の集計画面 (種別フィルタが必要になる)

- Cycle Time: `app/routes/$orgSlug/analysis/cycle-time/`
- Throughput (ongoing / deployed / merged): `app/routes/$orgSlug/throughput/{ongoing,deployed,merged}/`
- Inventory: `app/routes/$orgSlug/analysis/inventory/`
- Reviews: `app/routes/$orgSlug/analysis/reviews/`

### 既存のスキーマ

- `pull_requests` テーブルに種別カラムは無い (現状はタイトルや branch 名から都度推定が可能だが永続化されていない)
- `db/tenant.sql:56-89` の構造を拡張する必要

## 設計判断

### 結論

PR を **4 種別** に分類し、**`pull_requests.pr_type`** カラムを追加して永続化する。種別判定は **規則ベース (title + branch + author の優先度規則)** で行う。

サイズや hotfix 性質などの **派生属性** は、永続列にせず、既存カラム (`additions` / `deletions` / `source_branch`) からダッシュボード層で query 時に派生させる。これにより閾値や branch 規約のチューニング時に migration を伴わずに済む。

### 4 種別の定義

| 種別               | 定義                                                                | cycle time の意味                    | ダッシュボード扱い                             |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| **release**        | 自動生成または人間が作る release PR (即マージ前提)                  | 「PR 作業時間」概念が成立しない      | **対象外**                                     |
| **template-merge** | テンプレートを派生プロダクトに合流する PR (commit は他ブランチ由来) | 同上                                 | **対象外**                                     |
| **dependency**     | Bot による依存性更新 (Renovate / Dependabot 等)                     | 自動マージ前提、人間作業時間ではない | **対象外** (既存 `excludeBots` と同じ判定範囲) |
| **normal**         | 上記以外。通常の人間作業の PR (hotfix・XL を含む)                   | 人間の作業 + review 時間             | **主表示** (issue #332 RDD の主軸対象)         |

### 派生属性 (永続化しない)

ダッシュボード層で必要に応じて派生フィルタ / sub-segment として提供する。本 RDD では基盤として「派生で扱う」ことを定義するに留め、UI 化は別 RDD (#426) で扱う。

| 派生属性      | 計算式                          | 想定用途                                    |
| ------------- | ------------------------------- | ------------------------------------------- |
| **is_xl**     | `additions + deletions ≥ 1000`  | 「Epic 級・大型 PR を除外して中央値を見る」 |
| **is_hotfix** | `source_branch LIKE 'hotfix/%'` | 「ホットフィックスを別軸で追跡」            |

### 判別シグナルと優先度

種別判定は title / branch / author を入力に **決定論的** に行う。シグナルの優先度は下表の上から順に評価し、最初に該当した種別を採用する (具体的な実装関数の構造・命名は実装フェーズで決める)。

| 優先度 | 種別               | 主シグナル                                                                          | 補助シグナル                                   |
| ------ | ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1      | **release**        | branch `release/*` または title `Release ...` 系 または **本番デプロイフロー** (注) | -                                              |
| 2      | **template-merge** | title `Merged ... into ...`                                                         | branch `template/*` または `template_update-*` |
| 3      | **dependency**     | author が bot (1, 2 に該当しないもの)                                               | 既存 `excludeBots` と同じ author 判定          |
| 4      | **normal**         | 上記いずれにも該当しない (default)                                                  | -                                              |

(注) **本番デプロイフロー**: `source_branch IN ('main', 'master') AND target_branch IN ('production', 'prod')`。複数テナント (実測 4 件 + 17 件) で release/Production/Upgrade/[release]/merge into prod など多様な title を持つが、本質はすべて「main で蓄積した変更を本番ブランチへ反映する PR」であり release と同等扱いとする。title regex を増やすより branch flow signal で一括捕捉する方が頑健。

判定パターンの正規表現・branch prefix の具体形は本 RDD では確定しない。受け入れ条件「4 種別 + 不一致 + 規約外の代表シナリオがテストで検証される」を満たすことのみ求める。テナント計測で得られたパターン (`/^(Release |chore\(release\):|release: )/`、`/^Merged .+ into /` 等) は実装着手時の出発点として参考にする。

### 不一致 (signal conflict) の扱い

両方のシグナルが強く出ていて矛盾するケース (例: `branch=feature/2.5.3` だが `title=Release 2.6.0`) は、上記ロジックの **OR 判定で release 等に正しく分類** される。同時に **warning として記録** し、画面で「規約外の命名」を可視化する。

実テナント計測では不一致発生率は **0.08% (1,182 件中 1 件)** で、運用に支障は出ない。

### 理由

- **データ起点**: 実テナント検証で、判定ロジックが両テナントで機能する (テナント A は不一致 0、テナント B は 1 件のみ) ことを確認
- **規則ベースの選択理由**: 多数決 / スコアベースは説明性が低く、LLM 分類はコスト高で再判定困難。規則ベースは決定論的で説明しやすい
- **release を bot より先に判定する理由**: release-please bot のような「release を自動生成する bot」を dependency に振ると意味が壊れる。release シグナル (title / branch) を最優先にすることで、bot か否かに関わらず正しく release に分類できる
- **本番デプロイフロー (`main → production`) を release に含める理由**: 実測でこのフローの PR は title が多様 (Release / Production / Upgrade / [release] / merge into prod 等) だが、cycle time の意味としては release と同じ (即マージ前提、main 蓄積分の本番反映)。title regex を 5〜6 個増やすより branch flow を 1 シグナルで持つ方が誤検出が少なく、未知タイトルにも頑健
- **`source IN ('main', 'master') AND target IN ('production', 'prod')` の特異性**: main から main への PR は GitHub 上作成不可。main を source とする PR は事実上「他ブランチへの集約反映」なので、target を `production`/`prod` に限定すれば false positive リスクは無視できる
- **`pr_type` だけ永続化する理由**: 種別判定は title 正規表現 + branch + author の組み合わせで non-trivial。集計クエリで都度書くと保守負荷が高い。一方 size / hotfix は単純な算術 / LIKE 式で済むため、永続化せずに query 層で派生させる方が、閾値・規約のチューニング (例: XL 境界 1000→800、`hotfix/*`→`hf/*`) のたびに migration を強いられない
- **派生属性の閾値・規約**:
  - `is_xl` 閾値 (`additions + deletions ≥ 1000`): 既存 PR Size 分類 (XS / S / M / L / XL) の **XL 境界** と同じ ([docs/pr-size-classification-guide.md](../pr-size-classification-guide.md))
  - `is_hotfix` 判定 (`source_branch LIKE 'hotfix/%'`): 規約がない組織では常時 false。これは現状受容 (規約整備のインセンティブにする)

### 採らなかった代案

- **案 A: 種別を都度計算 (スキーマ変更なし)** — 集計クエリで `CASE WHEN` を書く。マイグレーション不要だが、種別判定ロジック (title 正規表現 + branch + author) が各クエリに散らばり保守負荷が上がる。種別の追加・変更時に全クエリを直す必要がある。採用しない
- **案 B: LLM で種別を分類** — `complexity` カラムで既に LLM 分類を使っているので延長線上で実装可能。規約外 PR にも対応できるが、コスト高 + 説明性低 + 再判定困難。本 RDD のスコープでは過剰。採用しない (将来 Open Question)
- **案 C: GitHub label を主シグナルにする** — `type:release` のような label を付けて分類。組織が label 規約を運用していれば強力だが、新規導入のコストと既存 PR への遡及付与が困難。採用しない (将来 override 機構として Open Question)
- **案 D: 種別を 3 種 (normal / 自動生成 / 大型) に絞る** — 過去案の一つ。却下理由: release / template-merge / dependency は「対象外にする理由」がそれぞれ異なる (即マージ / 他ブランチ commit / 自動更新)。フィルタ操作で個別に切り替えたいので一括りにできない。採用しない
- **案 E: 規約 (release/\* ブランチ等) を強制する** — 規約遵守を強制すれば判定が完全になるが、組織文化への介入で本書スコープ外。採用しない
- **案 F: `pr_type` を 6 値で持つ (normal / release / template-merge / dependency / hotfix / large)** — 本 RDD の旧案 (PR #430 初版)。以下 2 点で却下:
  - hotfix と large は「種別」(本物 PR か否か) ではなく「サイズ / 性格」(本物 PR の中での性質) を表す軸であり、1 列で 2 軸を兼ねるのは設計負債
  - XL 閾値や branch 規約のチューニング (例: 1000→800、`hotfix/*`→`hf/*`) のたびに既存データの再 migration が必要になる。派生属性として持てば query を変えるだけで済む
  - 採用しない (本案は派生属性パターンに置き換え)

## 要件

### 機能

- 各 merged PR は **4 種別のいずれか** に分類される (`pull_requests.pr_type` カラム)
- 種別判定は title / branch / author を入力に **決定論的** に行われる
- ダッシュボード (Cycle Time / Throughput / Inventory / Reviews) は **種別フィルタ** を持ち、デフォルトで `normal` のみを集計対象とする (release / template-merge / dependency は除外)
- ユーザーは種別フィルタをトグルで `release` / `template-merge` / `dependency` を個別に含めることができる
- 派生属性 (`is_xl` / `is_hotfix`) はクエリ層で計算可能な状態にしておく。UI フィルタ化は別 RDD (#426) で扱う
- 種別判定で **シグナル不一致 (warning)** が起きた PR は別途リストアップできる (規約外命名の検出)

### 非機能

- 種別判定は recalculate (`pnpm tsx batch/cli.ts recalculate <org-id>`) で全 PR に一括付与できる
- 既存 PR の種別付与は **数分以内** (テナント A 約 4,200 件で実測可能な範囲) に完了する
- 種別カラム追加によるクエリ性能の劣化を起こさない (インデックスは要件分析後に判断)
- tenant DB の org scoping は既存どおり (`getTenantDb(organizationId)`)
- 実テナント名・社名・実データ由来の固有数値を新規 docs / fixture / test に含めない (NDA 配慮、`docs/agent-rules/confidentiality.md`)

## スキーマ変更

`db/tenant.sql` の `pull_requests` テーブルに 1 カラム追加:

```sql
ALTER TABLE pull_requests ADD COLUMN pr_type TEXT;
-- NULL = recalculate 前
-- 'release' / 'template-merge' / 'dependency' / 'normal' (4 値)
-- size / hotfix 性質は派生属性として query 層で扱うため永続列にしない
```

加えて、不一致 warning の記録に 1 カラム:

```sql
ALTER TABLE pull_requests ADD COLUMN pr_type_warning TEXT;
-- NULL = 警告なし
-- 'signal-conflict' = 強い signal が矛盾している (規約外命名)
```

migration:

- 既存 PR の `pr_type` は NULL でデプロイ
- recalculate で全 PR に種別を付与
- migration 失敗時の rollback はカラム DROP (既存データへの影響なし)

## アプリケーション変更

### 必須

- PR upsert 経路に種別判定を組み込む (`batch/jobs/` 配下の該当ロジック)
- 種別判定モジュールを `batch/bizlogic/` 配下に新設し、ユニットテストを伴う (実装の分割粒度・命名は実装フェーズで判断)
- `batch/commands/recalculate.ts` (該当箇所) で `pr_type` / `pr_type_warning` を再計算する処理を追加
- `app/services/type.ts` を再生成 (`pnpm db:generate`)
- 各画面の集計クエリに種別フィルタを追加:
  - `app/routes/$orgSlug/analysis/cycle-time/+functions/queries.server.ts`
  - `app/routes/$orgSlug/throughput/{ongoing,deployed,merged}/+functions/queries.server.ts`
  - `app/routes/$orgSlug/analysis/inventory/+functions/queries.server.ts`
  - `app/routes/$orgSlug/analysis/reviews/+functions/queries.server.ts`
- 各画面に種別フィルタ UI トグルを追加 (3 トグル: `release` / `template-merge` / `dependency` を個別に含める。inventory 画面の `excludeBots` トグルパターンを流用)
- 不一致 warning PR をリストアップする画面または API を提供 (admin 系画面で十分、一般ユーザー向けは Open Question)

### 補助 (本 RDD の主軸ではないが整合のため触れる)

- 既存の `excludeBots` フィルタは **そのまま残す**。種別フィルタは「dependency 種別を除外」と意味が等価だが、`excludeBots` は author レベルの判定で別の意図 (例: bot author の PR を全部除外) として有用
- 派生属性 (`is_xl` / `is_hotfix`) を使った sub-filter UI は本 RDD のスコープ外。query 層で計算可能な基盤を提供するに留め、UI 化は別 RDD (#426) で扱う
- issue #332 の Cycle Time 画面再設計 (PR #426) は本 RDD 完了後に主軸を再確認する

## 移行方針

段階的に展開:

1. **スキーマ追加 + recalculate**: マイグレーションで 2 カラム追加、batch を更新、recalculate で全 PR に種別付与
2. **集計クエリの種別フィルタ対応**: 各画面の query を拡張、デフォルト種別 (`normal` のみ) を適用
3. **画面 UI の種別トグル追加**: 3 トグル (release / template-merge / dependency を個別に含める) を追加
4. **不一致 warning の可視化**: admin 系画面で warning 一覧を出す
5. **issue #332 RDD の主軸再確認**: 本 RDD 完了後、PR #426 を更新または書き直して merge

各 PR のサイズは [../practices/pr-flow/pr-size-discipline.md](../practices/pr-flow/pr-size-discipline.md) の 200-400 行基準に収める。段階分割は [../practices/pr-flow/stacked-prs.md](../practices/pr-flow/stacked-prs.md) のパターン。

**後方互換性**: スキーマ追加のみ (既存カラムは変更なし)、デフォルト種別フィルタが `normal` のみとなり従来の表示と乖離する。これは意図された変更で、画面冒頭の説明文で「以前と数値が変わる」旨を明示する。

## 受け入れ条件

- [ ] `db/tenant.sql` に `pull_requests.pr_type` と `pull_requests.pr_type_warning` カラムが追加され、マイグレーションが通る
- [ ] PR 種別判定のユニットテストが、4 種別 + 不一致 (signal-conflict) + 規約外 (normal フォールバック) + 本番デプロイフロー (`main → production`) + `template_update-*` branch の代表シナリオを網羅して green
- [ ] `pnpm tsx batch/cli.ts recalculate <org-id>` 実行後、merged PR の `pr_type` が **4 種別のいずれかに設定されている (NULL でない)**
- [ ] Cycle Time / Throughput / Inventory / Reviews の各画面で種別フィルタを操作でき、トグル変更が表示数値に反映される (既定で `normal` のみを集計対象、`release` / `template-merge` / `dependency` を個別に含めるトグルが提供される)
- [ ] 種別フィルタと既存 `excludeBots` フィルタは独立に AND で適用される (例: `excludeBots=ON` かつ `dependency` を含めても、bot author の dependency PR は除外されたままになる)
- [ ] 不一致 warning (`pr_type_warning = 'signal-conflict'`) の PR を一覧で確認できる (admin 系画面で十分、UI 場所は実装フェーズで判断)
- [ ] `pnpm validate` が green
- [ ] 新規 docs / fixture / test に実テナント名・社名・実データ由来の固有数値が含まれない

## リスク・補足

- **規約外 PR の誤分類**: ブランチ命名や title 規約に従っていない PR は normal にフォールバックする。`unknown` 種別を作る案も検討したが、ユーザーに「unknown」を見せても判断できる情報がなく操作不能なため採らない。代わりに `pr_type_warning = 'signal-conflict'` で規約外パターンの可視化を提供し、運用側で命名規約の整備に繋げる
- **判別 regex のメンテ**: `release/*` `Merged ... into ...` 等のパターンは組織文化に依存する (例: `release/*` ではなく `rel/*` を使う組織)。本 RDD は upflow 既知の規約 (実テナント計測ベース) で **固定** する (スコープ宣言の通り)。テナント差異が運用後に顕在化したら別 RDD でスキーマ拡張を扱う
- **既存ユーザーへの影響**: 種別フィルタ既定で release / template-merge / dependency が除外されると、既存ユーザーが「先月と数値が違う」と感じる。画面冒頭の説明文 + 各種別を含めるトグルで対応
- **派生属性 (`is_xl` / `is_hotfix`) の閾値・規約**: query 層で派生計算するためチューニングは migration 不要。XL 閾値 1000 行 (PR Size 分類の XL 境界) や `hotfix/*` branch 規約はテナントによって体感が異なるが、運用で必要になった時点で query パラメタや `organizationSettings` で可変化を検討 (Open Question 2)
- **closed issue #428 の論点 (firstCommittedAt の first-parent traversal)**: 本 RDD で release / template-merge / dependency / 本番デプロイフローを対象外にすれば、アーティファクトの大半は発生しない。実測で残る normal 種別 PR の中の **真の first-parent artifact は両テナントで 0 件** (テナント B の lead_d > 30 残存 21 件を個別確認した結果、12 件は本物の長期 PR、7 件は本番デプロイフロー [本 RDD で吸収]、2 件は stacked PR / sibling branch 由来の別種 artifact で first-parent では解消しない)。Q3 は「empirical に必要が出た時点で別 issue 化」の defer 判断
- **stacked PR / sibling branch artifact (新規発見)**: テナント B で 2 件確認 (例: `issue/241` ブランチが `issue/211` から派生し、両者の commit を共有)。`firstCommittedAt` が parent branch の最古 commit になるため数 ヶ月の lead が出る。first-parent traversal では遡れない (sibling branch の linear history は parent の commit を含むため)。impact は < 0.1% で defer 妥当 (Open Question 6)

## Open Questions (人間レビューで解消すべき論点)

1. **種別の手動 override 機構**: GitHub label (`type:release` 等) で自動分類を上書きできるようにするか。導入時期はいつか (本 RDD 範囲か別 RDD か)
2. **派生属性のチューニング機構**: `is_xl` 閾値 (1000 行)、`is_hotfix` branch prefix (`hotfix/`) を将来 `organizationSettings` で可変化するか、全テナント共通にするか (本 RDD のスコープ外、運用後に判断)
3. **本番デプロイ branch 名のテナント差**: 本 RDD は `target IN ('production', 'prod')` を固定値で持つ。観測 2 テナントは両方ともこの命名だが、`live`、`prd`、`prd-main` 等を使うテナントが将来現れた場合に `organizationSettings` で可変化するか (運用後に判断)
4. **不一致 warning の UI 表現**: 一般ユーザー向けの可視化が必要か (規約遵守を促すダッシュボード)、admin 専用で十分か
5. **`epic/*` ブランチ等の追加派生属性**: 旧案では `epic/*` ブランチを `large` 判定の signal にしていた。本 RDD では削除したが、Epic 単位の追跡需要が顕在化したら `is_epic` 派生属性を追加するか (本 RDD では扱わない)
6. **stacked PR / sibling branch artifact 対策**: 実測 < 0.1% の頻度。`firstCommittedAt` が parent branch の commit を拾う問題。first-parent traversal では解決しない (sibling branch の linear history を遡るため)。完全解消には git history 解析が必要だが ROI が低い。defer して #426 ダッシュボード上で問題が顕在化した時点で別 RDD 化するか
7. **closed issue #428 の first-parent traversal**: 実測で対象 0 件 (本番デプロイフロー signal 追加後)。defer して、運用観測で必要が出たら別 issue 化
