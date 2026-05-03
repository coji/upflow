# takt 運用メモ

このリポジトリで [`takt`](https://github.com/nrslib/takt) を実運用したときに遭遇した挙動と回避策をまとめる。issue #365 の追跡ノート。

## 起動

### 推奨コマンド

```bash
takt -i <issue#> -w spec-implement-accept
```

`-w` は workflow 名を明示するため。省略すると `default` が選ばれてしまう (project-local default 指定の方法は要調査)。

### TUI 対話モード (現状の挙動)

`takt 0.39.0` は `-i` で起動しても「アシスタント / ペルソナ / クワイエット / Cancel」の選択 TUI が出る。Claude Code バックグラウンドや CI から puppet できない。

**緩和策**: workflow YAML に `interactive_mode: quiet` を書くとデフォルト選択が quiet になり、Enter 1 回で進める。本リポジトリでは `.takt/workflows/spec-implement-accept.yaml` で設定済み。

**完全 bypass**: upstream の [nrslib/takt#605](https://github.com/nrslib/takt/issues/605) (closed 2026-05-02) で `interactive_mode: none` と `skip_interactive_mode_selection` が追加された。0.39.0 にはまだ含まれない。**0.40.0 リリース後**にこのファイルと workflow YAML を更新する。

### 単発ワークフロー (issue 紐付けなし) のサクッと実行

issue を伴わずワークフローだけ動かしたい場合は `-t` に 1 文字渡すと `passthrough` モードが選択肢に入り、menu 1 ステップ + 即実行で済む:

```bash
takt -w <ワークフロー名> -t y
```

**ただし `-i` を併用すると `-t` は無視される** (`routing.js` で `directTask = undefined` にリセットされるため)。issue 経路ではこの近道は使えず、上記の `interactive_mode: quiet` プリセレクトが現状最善。

## worktree

### 「対話 → 実行 (execute)」では worktree が作られない

upstream の [#412](https://github.com/nrslib/takt/issues/412) / [#411](https://github.com/nrslib/takt/issues/411) / [#482](https://github.com/nrslib/takt/issues/482) で「execute action では worktree を作らない」が design 決定済み。

→ 「対話モードで /go して execute」フローでは現在の checkout 上で直接動く。`main` 上で takt を回すと作業中の uncommitted change と混ざるリスクあり。

### worktree を確実に使いたい場合

タスクをキューに積んでから run する経路:

```bash
takt add  # task spec 作成 → .takt/tasks/<slug>/order.md
takt run  # キュー消化 (この経路では worktree が作られる)
```

または `takt --pipeline` (CI 用、worktree 無しで現在のブランチに直接 commit する別物なので注意)。

実運用上の安全策: **takt 起動前に必ずクリーンな branch を切る**。`main` で起動しない。

## 残骸

### `order.md` がプロジェクト root に残る

`-i` で直接起動した場合、`spec-draft` step の agent が `order.md` を **cwd (= project root)** に書く。takt 自身は `.takt/runs/<slug>/context/task/order.md` を期待するが、`-i` 経路ではこのファイルを書き出さないため agent が独自に作る。

**回避策**: `.gitignore` に `/order.md` を追加済み (PR #364)。コミット時に巻き込まれない。

upstream に「`-i` 経路でも takt 側で context/task/order.md を書き出す or facet prompt で path を明示できるようにする」を要望予定。

## PR / git ops

### `auto_pr: false` (現状)

`.takt/config.yaml` で `auto_pr: false` 運用。ブランチ切り → commit → push → PR は人間が叩く。

`auto_pr: true` に切り替えると supervise step 完了後に自動 PR 作成。次の takt run で 1 度試して挙動を見る予定。

### ブランチ命名

`pipeline.default_branch_prefix: 'takt/'` は **pipeline モード専用**。通常モード + worktree-execute 経路では適用されない。

## Claude Code 連携

### Skill 起動が takt 表面から見えない

takt のステップが Claude Code 経由で `Skill('simplify')` など Claude Code skill を起動しても、takt の TUI には agent の最終 text response しか表示されない。「skill 使ったか?」が判別できないため誤解を生む。

確認したい場合は Claude Code セッションの jsonl ログ (`~/.claude/projects/<project-hash>/<session-uuid>.jsonl`) で `tool_use.name == "Skill"` を grep する。

upstream に「skill / sub-agent invocation を trace に拾う」を要望予定。

### artifact discovery

run 完了後の生成物 (worktree path / RDD ファイル / commit hash / 変更ファイル一覧) は手動 `git status` 頼り。upstream に `--report-json` 的な機械可読サマリを要望予定。

## 関連

- issue #365 (本ドキュメントの追跡 issue)
- PR #364 (takt 初実運用 — e2e foundation)
- nrslib/takt v0.39.0 / 0.40.0 (#605 含む)
