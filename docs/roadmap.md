# Roadmap

Upflow の直近の優先順位をまとめた実行計画。

方針:

- まずは現行の Node ベース開発体験を維持する
- 先に「全件再処理」から「変更単位処理」へ寄せる
- 新しい外部基盤は増やしすぎない

## 現在の優先順位

1. shared DB 上で Durably を導入する
2. GitHub webhook を入れ、`sync_pull_request` を trigger する
3. Node worker を追加して Durably job を処理する
4. crawler を補完ジョブへ縮退させる
5. `analyzeAndUpsert` を PR 単位 / repo 単位へ分解する
6. ローカル tenant DB ファイル前提をやめ、Turso 上の `tenant-per-db` に置き換える
7. サーバ側の sync API の土台を入れる

## いまやること

### 1. Durably を導入する

- shared DB を state store として使う
- まずは SQLite のままで始める
- 外部キューや Redis は入れない
- 自前の queue/lease/retry 実装は増やさない

最初のジョブ種別:

- `sync_pull_request`
- `rebuild_repository`
- `full_backfill`

### 2. Webhook を主経路にする

- GitHub App / webhook endpoint を追加
- `pull_request` 系イベントで対象 PR を特定
- `sync_pull_request` を trigger する
- 該当 PR だけ raw を更新
- 該当 PR だけ `pull_requests / pull_request_reviews / pull_request_reviewers` を再 upsert

最初に購読するイベント:

- `pull_request`
- `pull_request_review`
- `pull_request_review_comment`
- 必要なら `issue_comment`

この段階では、Webhook を同期の主経路にし、cron はまだ残す。

### 3. Node worker を追加する

- Durably job を処理する worker プロセスを追加
- Web プロセスと分離する
- 最初は単一 worker でよい

必要になったら、後で Fly.io 上で worker を増やす。

### 4. crawler を補完にする

- webhook の取りこぼし補完
- 初回バックフィル
- 長期間止まっていたテナントの追いつき
- 定期整合性チェック

この段階で、毎時の全件寄り再処理をやめ、補完・整合性確認に役割を絞る。

### 5. バッチの責務分割

最低でも次の単位へ分ける。

- `sync_pull_request`
- `rebuild_repository`
- `classify_pull_requests`
- `export_reports`

原則:

- `fetch` は raw 保存に寄せる
- `transform` は read model 更新に寄せる
- テナント全体を 1 ジョブで握らない
- まずは PR 単位、次に repo 単位で処理できる形にする
- step ごとに再開できる形に寄せる

## 機能開発の優先順

データ更新経路の整理が終わるまでは、大きい新機能は増やしすぎない。

機能候補は [future-ideas.md](./future-ideas.md) にまとめている。

考える順番は:

1. `reviews dashboard`
2. `personal dashboard`

## 補足のアーキテクチャ原則

- Source 層は GitHub API に近い形で冪等保存する
- Read model はアプリが直接読む形に保つ
- Turso に移る場合も `tenant-per-db` を維持する
- テナントごとの負荷分離とクロステナント漏洩リスクの縮小を優先する
- 主経路は `webhook -> Durably -> Node worker` にする
