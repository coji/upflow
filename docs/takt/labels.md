# TAKT Issue Labels

TAKT のオーケストレーションが「どの GitHub issue を自動処理の対象にするか」を決めるときに参照するラベル規約と、ラベルとランタイム（`takt-poll` / Symphony）の対応をまとめる。

## ラベルの意味

### `takt-ready`

Issue が TAKT によって処理されてよい状態であることを示す。自動処理でピックアップされる候補になる。

### `takt-blocked`

手動でブロックが解除される（オペレータが `takt-blocked` を外すなど）まで、TAKT による自動処理の対象にしないことを示す。

### `priority:high` / `priority:medium` / `priority:low`

複数の `takt-ready` タスクが未処理として並んでいるときの**選択順**を決める。ラベル名どおり、`priority:high`、`priority:medium`、`priority:low` の三段階として扱う。

**優先順位（高い順）**: `priority:high` → `priority:medium` → `priority:low`

同時に複数件が pending のときは、上記の順で先に処理候補に選ぶ。

### 競合時・未指定時の解決

- **複数の `priority:*` が同時に付いている場合**: 最も高い段階を採用する。例: `priority:high` と `priority:low` が同時に付いていれば `priority:high` として扱う
- **`priority:*` が未指定の `takt-ready` issue**: `priority:medium` として扱う（明示指定された `priority:medium` と同等）
- **同段階内の順序**: `priority` 解決後に同段階の issue が複数残った場合は、issue 番号の昇順で処理候補に選ぶ

## ランタイムとの対応（`takt-poll` / Symphony）

- **`takt-poll`（cron）**  
  `takt-ready` が付いた issue は、`takt-poll` の対象になりうる。この適格性は Symphony 側の `active_states` によって表現される。

- **ブロック**  
  `takt-blocked` が付いた issue は自動処理から除外される。この除外は Symphony 側の `blocked_by` によって表現される。

- **`takt-ready` と `takt-blocked` の両方がある場合**  
  `takt-ready` が同時に付いていても `takt-blocked` が優先され、TAKT による処理は行わない。

## スコープ

このページは GitHub issue のラベル運用と、上記の TAKT / Symphony における名前付き概念に限定する。アプリケーションのソース、データベーススキーマ、それ以外の実装内部の詳細は扱わない。
