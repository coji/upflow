# Issue #283 Stacked PR 作業計画

RDD: [`issue-283-multiple-github-accounts.md`](./issue-283-multiple-github-accounts.md)

## 方針

- **Graphite (`gt`) を使って stacked PR を運用する**
  - 上位 PR にレビュー指摘が入って下位を直したら `gt sync` / `gt restack` で stack 全体を追従
  - `gt submit` で stack を一括 PR 化 / 更新
  - PR description には Graphite が stack 構造を自動挿入してくれる
- マージは下から順。Graphite が下位 PR マージ後に上位 PR の base を自動更新
- 各 PR description に「この PR で満たす受入条件番号 / 後続に委ねる番号」を明記
- backfill PR と strict 切替 PR の **本番デプロイ順序** は厳守。stack 上は連続でも、デプロイは「backfill デプロイ完了 → 検証 → strict 切替デプロイ」の順
- 本作業終了後、Graphite の使い勝手を評価してまとめる

## 前提

- 本 work plan / RDD は PR #287 (`feat/issue-283-multiple-github-accounts` ブランチ) として独立先行マージする
- 実装 stack は #287 マージ後、`main` から開始する

## ブランチ命名

`feat/issue-283-<段階>` 例: `feat/issue-283-schema`

`gt create <branch>` で新規スタック作成。

## PR Stack

### PR 1: schema + 型生成

**ブランチ**: `feat/issue-283-schema` (base: `main`、`gt create` で作成)

**スコープ**:

- `db/shared.sql`: `github_app_links` の主キー変更、`UNIQUE (github_account_id)` 削除、`suspended_at` / `github_account_type` / `membership_initialized_at` 追加、`github_app_link_events` table 追加
  - 注: `github_app_link_events` の writer は PR 3。schema を PR 1 に集約するために未使用 table が一時的に main に入ることを許容する
- `db/tenant.sql`: `repositories.github_installation_id` 追加、`repository_installation_memberships` 追加
- `db/migrations/shared/*`, `db/migrations/tenant/*`: Atlas 自動生成 + 手動レビュー
- `app/services/type.ts`: kysely-codegen 再生成
- `db/seed.ts`: 新カラムを seed が壊さないよう最小修正
- migration テスト（Atlas 適用 → ロールバック確認）

**スコープ外**:

- アプリケーションコードからの新カラム参照
- `integrations.app_suspended_at` の削除（後続 PR 7 で実施）

**満たす受入条件**: 2, 3
**注意**:

- migration は本番 DB 相当 (`pnpm ops pull-db`) で適用テスト
- `github_app_links` の複合主キー化は table 再作成を伴うため、Atlas 生成 SQL を必ずレビュー

---

### PR 2: query / mutation 層 + Octokit 解決の repository 単位化

**ブランチ**: `feat/issue-283-query-octokit` (base: 直前の PR ブランチ、`gt create` で作成)

**スコープ**:

- `app/services/github-integration-queries.server.ts`:
  - `getGithubAppLink()` → `getGithubAppLinks()` 配列返却
  - `getGithubAppLinkByInstallationId()` 追加
  - `assertInstallationBelongsToOrg(orgId, installationId)` 追加（active / non-suspended / non-deleted 検証）
- `app/services/github-app-mutations.server.ts`:
  - `disconnectGithubAppLink(orgId, installationId)` 追加
  - 「最後の active を失ったときだけ `method=token` に戻す」ロジック
  - cross-store 整合性ルール（tenant first / shared second）と `github_app_link_events` への audit log を含む（PR 1 で追加した table の初回 writer がこの mutation。canonical reassignment helper 自体は PR 3 だが、disconnect の audit log writer は PR 2 で先行して入る）
- `app/services/github-octokit.server.ts`:
  - `resolveOctokitForRepository()` / `resolveOctokitForInstallation()` 追加
  - `resolveOctokitFromOrg()` は deprecated にして call site 移行（互換 wrapper を残す）
- `batch/db/queries.ts`: `getOrganization()` / `listAllOrganizations()` の shape 更新（`githubAppLinks[]` + repository の `githubInstallationId`）
- `app/services/jobs/crawl.server.ts` / `backfill.server.ts`: repository ごとに Octokit を解決（移行期間 fallback 込み）
- `batch/commands/{crawl,backfill,helpers}.ts` / `batch/job-scheduler.ts` / `batch/config/index.ts`: shape 変更追従
- **移行期間 fallback ロジック実装**: `github_installation_id IS NULL` の repository に対する `resolveOctokitForRepository()` の挙動:
  - `integrations.method = 'github_app'`:
    - org の active link が 1 件 → その installation を使う
    - active link が 0 件 → 未割当エラー（**PAT に自動 fallback してはいけない**。RDD L171-175 のルール）
    - active link が 2 件以上 → 未割当エラー
  - `integrations.method = 'token'`:
    - `private_token IS NOT NULL` → PAT を使う
    - `private_token IS NULL` → 未接続エラー
- 既存テスト更新

**スコープ外**:

- webhook / setup callback の修正（PR 3）
- UI 変更（PR 4）
- membership table の更新ロジック（PR 3）
- `searchGithubUsers()` / `repositories.add` の `installationId` 引数化（caller の選択 UI が PR 4 で入るため。PR 2 では既存 caller の互換維持に留める）

**満たす受入条件**: 6
**注意**:

- この PR 単独でビルド・テスト・既存挙動が壊れないこと。新規関数の追加と内部 caller の差し替えのみで、外部 API シグネチャは変えない
- 移行期間 fallback は RDD の重要パート。テストで「active 1 件 / 0 件 / 複数件」の 3 ケースを必ずカバー

---

### PR 3: setup callback + installation webhook + membership 永続化 + 自動 repair

**ブランチ**: `feat/issue-283-webhook-membership` (base: 直前の PR ブランチ、`gt create` で作成)

**スコープ**:

- `app/routes/api.github.setup.ts`:
  - `(orgId, installationId)` 単位 upsert
  - `github_account_type` 保存
  - membership 初期投入 + 成功時に `membership_initialized_at` セット
  - 失敗時は link のみ保存
- `app/services/github-webhook-installation.server.ts`:
  - `findActiveLinkByInstallationOrAccount()` 削除
  - `installation.deleted` / `suspend` / `unsuspend` を installation 単位更新
  - `installation_repositories.added/removed` で membership 更新 + canonical reassignment helper 呼び出し
- `app/services/github-webhook-shared.server.ts` / `github-webhook.server.ts`: dispatch 周りの追従
- `app/services/github-webhook-pull.server.ts`: `owner + repo + installation_id` lookup へ変更
- canonical reassignment helper（mutation 層）:
  - membership 候補数で 0/1/2+ を判定
  - reassignment 候補は `membership_initialized_at IS NOT NULL` の link のみ。未初期化 link は候補から除外し、初期化済み候補が 0 件かつ未初期化 link が残るケースは assignment required に倒す
  - tenant first / shared second
  - `github_app_link_events` への audit log
- 自動 repair:
  - durably ジョブとして実装。`crawl.server.ts` の冒頭に独立した step `repairUninitializedMemberships` を追加
  - step 内で `membership_initialized_at IS NULL` の active link を検出 → `installation_repositories` を再 fetch → membership upsert → 成功時に `membership_initialized_at = now`
  - durably の中断・再開を考慮し、step は per-link で分割可能にする（1 link 失敗が他 link を巻き込まない）
  - 失敗時は次回 crawl で再試行（`membership_initialized_at IS NULL` のまま）
- webhook / mutation のテスト追加:
  - cross-store 整合性: tenant 更新成功 / shared 更新失敗時の orphan 検出と repair
  - idempotency: 同じ webhook を 2 回受けた時に最終状態が同一
  - canonical reassignment: 0/1/2+ 候補それぞれのケース
  - 未初期化 link ガード: 未初期化 link は reassignment 候補から除外。初期化済み link からの reassignment は許可、初期化済み候補 0 件かつ未初期化 link 残存時のみ assignment required に倒れる
  - audit log: 各 event_type が `github_app_link_events` に正しく記録される

**スコープ外**:

- UI 変更（次 PR）
- backfill / strict 切替

**満たす受入条件**: 8, 9, 10, 11, 12, 19, 22, 23
**注意**:

- cross-store 整合性ロジックはこの PR の最重要箇所。テストカバレッジを厚めに
- idempotency 確認（同じ webhook を 2 回受けても結果が同じ）

---

### PR 4: UI 変更（integration settings / repositories.add / github-users）

**ブランチ**: `feat/issue-283-ui` (base: 直前の PR ブランチ、`gt create` で作成)

**スコープ**:

- `app/routes/$orgSlug/settings/integration/index.tsx` + `_index/+forms/integration-settings.tsx`:
  - `githubAppLinks[]` 表示
  - installation 単位 connected / suspended / deleted バッジ
  - `Add another GitHub account` ボタン
  - personal account / org の URL 分岐 (`github_account_type`)
  - installation 単位 disconnect
- `app/routes/$orgSlug/settings/repositories.add/index.tsx` + `+functions/queries.server.ts` + `+functions/mutations.server.ts`:
  - installation selector（loader / action / cache key に `installationId` 反映）
  - `github_app` モードで installation 必須
  - server-side で `assertInstallationBelongsToOrg()` による検証
  - `addRepository()` mutation に `githubInstallationId` 引数追加
- `app/routes/$orgSlug/settings/github-users._index/`:
  - installation selector
  - `searchGithubUsers()` API に `installationId` 引数
  - server-side 検証
- `assertInstallationBelongsToOrg()` は PR 2 で既に追加済み。本 PR では loader / action から呼び出すだけ
- e2e / route テスト更新

**満たす受入条件**: 1, 4, 5, 13, 14, 15, 17, 21
**注意**:

- `repositories.add` の cache key を `installationId` 込みに変更すること（既存固定 key の漏れに注意）
- personal account の URL は `/settings/installations/<id>`、org は `/organizations/<login>/settings/installations`

**テスト要件**:

- `assertInstallationBelongsToOrg()` で他 org の installation / deleted / suspended を弾くこと
- `repositories.add` の cache key が installation 切替で正しく無効化されること
- selector を持たない personal account の文言と URL が正しく分岐すること

---

### PR 5: PR webhook lookup 強化 + repository list/detail の installation 表示 + assignment required UI

**ブランチ**: `feat/issue-283-repo-ui` (base: 直前の PR ブランチ、`gt create` で作成)

**スコープ**:

- `app/routes/$orgSlug/settings/repositories._index/queries.server.ts`:
  - `github_installation_id` を select に追加
  - `assignment required` 判定
- `app/routes/$orgSlug/settings/repositories._index/index.tsx`:
  - installation 名 / `assignment required` バッジ表示
  - 再選択フォーム
- 注: `repositories.add/+functions/queries.server.ts` は PR 4 が触る。本 PR は触らない
- `app/routes/$orgSlug/settings/repositories/$repository/queries.server.ts` / `$pull/`:
  - installation 情報を含めて取得
- 注: `github_installation_id` を select する箇所が PR 3 (webhook lookup) と PR 5 (一覧 / 詳細) に分散するため、共通 select fragment を `app/services/github-integration-queries.server.ts` 等に切り出すことを検討する。本 PR で実施するか PR 3 にバックポートするかは実装時に判断
- 個別 repository の installation 再選択 mutation:
  - PR 3 で実装する canonical reassignment helper を再利用する
  - target installation が `repository_installation_memberships` に `deleted_at IS NULL` で存在することを必ず検証
  - 検証に通らない installation を指定した場合はエラーを返す
  - cross-store 整合性ルール（tenant first / shared second）に従う
- batch 側に `reassign-repository-installation` CLI 補助コマンド追加（同 helper を共有）

**満たす受入条件**: 7, 18

**テスト要件**:

- 再選択 mutation: target installation が membership に存在しないケースでエラーを返す
- 再選択 mutation: 検証通過時に `repositories.github_installation_id` 更新と `github_app_link_events` 記録が両方行われる
- list / detail loader が `assignment required` を正しく判定する

---

### PR 6: backfill CLI + dual-read/write 期間の fallback ルール明示

**ブランチ**: `feat/issue-283-backfill` (base: 直前の PR ブランチ、`gt create` で作成)

**スコープ**:

- batch CLI に `backfill-installation-membership` コマンド追加:
  - 全 org をスキャン
  - active link 1 件の org → 既存 repository を一括 backfill
  - active link 0 件 → `NULL` のまま、UI 警告
  - active link 複数件 → 自動 backfill 不可、リスト出力
- 本 PR の実装スコープは backfill CLI のみ。dual-read/write fallback と canonical reassignment は PR 2 / PR 3 で既に実装済みであり、本 PR では新規実装しない
- 本 PR は backfill CLI 追加 + 本番 backfill 実行手順 (Runbook) + 検証手順を含む
- `pnpm db:setup` の seed が新 schema で動くことを確認
- ドキュメント: `docs/rdd/issue-283-multiple-github-accounts.md` の該当箇所と整合

**満たす受入条件**: 20 の前半（schema → backfill 完了）
**デプロイ注意**:

- ✅ この PR を本番マージ
- ✅ 本番で backfill コマンドを実行
- ✅ `repositories.github_installation_id IS NULL` が想定通り 0 件であることを検証
- ⚠️ 検証完了まで PR 7 はマージしない

**Runbook テンプレート** (PR 内に含める):

1. 本番デプロイ完了確認 (`fly status`)
2. backfill 前の状態スナップショット
   - `SELECT count(*) FROM repositories WHERE github_installation_id IS NULL`（org ごと）
   - `SELECT count(*) FROM github_app_links WHERE deleted_at IS NULL`（org ごと）
3. backfill 実行: `pnpm tsx batch/cli.ts backfill-installation-membership`
4. 完了後の検証
   - `repositories.github_installation_id IS NULL` が token method org のみ
   - `repository_installation_memberships` が active link 数 × 期待 repository 数と一致
   - `github_app_links.membership_initialized_at IS NULL` の row が無い
5. 異常時の rollback
   - backfill は冪等なので再実行可能
   - データ破損が検出された場合は `repositories.github_installation_id` を NULL に戻すクエリを準備

---

### PR 7: strict lookup 切替 + 旧 fallback 削除 + `integrations.app_suspended_at` 削除

**ブランチ**: `feat/issue-283-strict` (base: 直前の PR ブランチ、`gt create` で作成)

**スコープ**:

- crawl / backfill / compare / webhook lookup から「active link 1 件 fallback」を削除
- `github_app` repository に `github_installation_id` が無い場合はエラー
- PR webhook は `owner + repo + installation_id` 一致以外を拾わない
- `integrations.app_suspended_at` カラム削除（migration）
- 関連 reader / writer / test の cleanup
- `resolveOctokitFromOrg()` の deprecated 削除

**満たす受入条件**: 16, 20（完全達成）
**デプロイ注意**:

- PR 6 の backfill 検証完了後にマージ
- マイグレーションは destructive。本番 DB 相当でリハーサル必須

**テスト要件**:

- `github_app` repository に `github_installation_id` が無い場合、crawl / backfill / compare / webhook 全経路でエラーを返す
- PR webhook の strict lookup: `installation_id` 不一致を確実に拒否する

**Rollback 戦略**:

- `integrations.app_suspended_at` 削除 migration を逆当てするための down migration を必ず作成
- 本番デプロイ前に staging で apply → rollback → re-apply のリハーサルを実施
- デプロイ後 24 時間は `github_app_link_events` の異常パターン (連続 reassignment / orphan repair の急増) を監視
- 異常検知時は PR 7 を revert + `app_suspended_at` を down migration で復活させる手順を Runbook に含める

---

### PR 8 (任意): RDD に Status セクション追加

**ブランチ**: `feat/issue-283-status` (base: `main`、stack 不要)

- RDD 末尾に `## Status` を追加し、PR 1-7 の番号を列挙
- Issue 283 を close
- **タイミング**: PR 7 マージ + 本番デプロイ + 動作検証完了後に作成する。strict 切替の検証が終わるまで Status セクションは追加しない

---

## マッピング表

| 受入条件          | 担当 PR                   |
| ----------------- | ------------------------- |
| 1                 | PR 4                      |
| 2                 | PR 1                      |
| 3                 | PR 1                      |
| 4                 | PR 4                      |
| 5                 | PR 4                      |
| 6                 | PR 2                      |
| 7                 | PR 5                      |
| 8                 | PR 3                      |
| 9                 | PR 3                      |
| 10                | PR 3                      |
| 11                | PR 3                      |
| 12                | PR 3                      |
| 13                | PR 4                      |
| 14                | PR 4                      |
| 15                | PR 4                      |
| 16                | PR 7                      |
| 17                | PR 4                      |
| 18                | PR 5                      |
| 19                | PR 3                      |
| 20                | PR 6 (前半) + PR 7 (完全) |
| 21                | PR 4                      |
| 22                | PR 3                      |
| 23                | PR 3                      |
| 24 (PAT 動作維持) | 全 PR で regression check |

## リスク

1. **PR 2-3 の競合**: query 層と webhook が同じファイルを触る箇所がある。PR 3 に rebase 衝突が出やすい
2. **PR 6→7 のデプロイ間隔**: backfill 検証中に新規 GitHub App install が来ると `membership_initialized_at IS NULL` の link が増える。検証ウィンドウは短くする
3. **e2e テスト**: PR 4 で UI が大きく変わる。Playwright 側の更新が必要
4. **`pnpm validate`**: 各 PR で必ず通す。schema 変更を含む PR 1 で `pnpm db:setup` も通す
5. **kysely-codegen 再生成**: PR 1 で `app/services/type.ts` 再生成。PR 2 以降は型を使うので、PR 1 がマージされるまで PR 2-7 のローカル動作は PR 1 ブランチ上で確認すること（Graphite なら親 commit を含むので問題なし）
6. **Atlas migration 番号衝突**: stack 全体の所要期間中に main で別の migration が入ると番号衝突する。PR 1 と PR 7 (`app_suspended_at` 削除) のどちらも main rebase 時に migration 番号を振り直す必要があるか確認する
7. **Graphite submit のタイミング**: 7 PR を一気に `gt submit --stack` するとレビュアー負荷が大きい。PR 1-3 を先に submit して review が進んでから PR 4-7 を submit する運用を推奨
8. **可観測性**: `github_app_link_events` table を Sentry または別ダッシュボードで監視できるようにする。具体的には PR 3 マージ後に以下を準備:
   - 異常パターン (`event_type='repair'` の急増、`status='failed'` の発生、同一 installation への連続 reassignment) の検知クエリ
   - canonical reassignment 失敗を Sentry に送る経路（`captureException` で十分。専用 dashboard は後日でよい）
   - PR 6 deploy 時と PR 7 deploy 後 24 時間は手動でも `github_app_link_events` を確認する

## 進行順

```
PR 1 (schema)
  └─ PR 2 (query/octokit)
       └─ PR 3 (webhook/membership)
            └─ PR 4 (UI)
                 └─ PR 5 (repo UI)
                      └─ PR 6 (backfill) ──[本番デプロイ + 検証]──
                           └─ PR 7 (strict)
                                └─ PR 8 (status)
```
