# PR Title Filter Emergency Disable

PR タイトルフィルタの緊急一括無効化を行うときの手順。issue #307 の rollback
手順 (4 番目) の手順書。

## いつ使うか

PR タイトルフィルタが本番で誤動作 (例: 過剰除外、loader が遅延、想定外パターンへの
マッチ) を起こしていて、

- reader code を revert する deploy (Phase 2 revert) が間に合わない
- table を残したまま機能だけ即座に止めたい

ケースの **stopgap**。reader / writer revert が間に合うならそちらを優先する。

## 手順

### 1. tenant DB の `is_enabled` を全行 0 にする

対象 organization の tenant DB に対して以下を実行する。本番では fly ssh
console から該当 org の tenant DB ファイル (`/data/tenant_*.db`) を開く:

```bash
fly ssh console -a upflow
sqlite3 /data/tenant_<org-slug>.db
```

```sql
UPDATE pr_title_filters SET is_enabled = 0;
SELECT id, pattern, is_enabled FROM pr_title_filters;
.quit
```

複数の organization に展開しているなら、tenant DB ファイルを **すべての**
org について順次実行する。

### 2. **必ず**: process-local cache を破棄する

`getOrgCachedData()` (`app/services/cache.server.ts`) は org-scoped な
process-local Map (`new Map<string, Map<string, CacheEntry>>()`) で **5 分
TTL** のキャッシュを持つ。SQL を流しただけでは loader が次回キャッシュ
ミスを起こすまでの **最大 5 分間** filtered 結果を返し続ける。これは「フィルタを
全 OFF にしたつもりがまだ効いている」ように見えるため、SQL 流したら即座に
cache 破棄を行う。

選択肢は 2 つ:

#### (推奨) プロセスごと再起動する

最も確実かつ早い:

```bash
fly machine restart -a upflow
```

restart 後 cache は空から始まるので、次回 loader は DB から直接読み、
`is_enabled = 0` が即時反映される。

#### (代替) `clearAllCache()` を呼ぶ

restart したくない場合は、サーバ側に投げ込む手段が現状ない。`clearAllCache()`
は export されているが、外部から呼ぶエンドポイントは用意されていない。
runbook 利用ケースで restart が許容できないなら専用 admin endpoint を
切る必要があるが、現時点ではその要件はないため **restart 一択** とする。

### 3. 確認

- 影響を受けたビュー (Review Stacks 等) を再読込し、フィルタされていた PR が
  再表示されることを確認する。
- バナー表示が「フィルタを無効化中」相当に変わっていることを確認する。
- 5 分以上経過してもまだ filtered 状態なら、cache 破棄が漏れた可能性がある
  ので restart をやり直す。

## 復帰手順

問題のあった pattern を特定し、`/settings/pr-filters` から該当 row だけを
個別 disabled / 削除して、ほかの row は `is_enabled = 1` に戻す:

```sql
-- 必要な row だけ戻す
UPDATE pr_title_filters SET is_enabled = 1 WHERE id IN ('<id-1>', '<id-2>', ...);
```

復帰時は cache 破棄は **不要**。`getOrgCachedData()` は 5 分 TTL なので
最長 5 分後には新しい状態が反映される。緊急性がなければそのまま待つ。

## なぜ手順書なのか (機械化方針メモ)

このルール (issue-307 § rollback 手順 4) は inventory `Medium #10` として
catalogued されているが、構造テストや lint で「**SQL を流したら必ず
restart せよ**」を強制するのは不可能 (SQL は本番に対する操作で、コードに
は現れない)。そのため `arch-review` ペルソナや CI ではなく **runbook
として人間に渡す** のが正しい機械化先になる。`docs/rdd/issue-336-rule-inventory.md`
からこのファイルへリンクする。
