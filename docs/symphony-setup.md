# Symphony worker sprite — setup runbook

issue #370 で設計した Symphony port の実行基盤。1 つの sprites.dev sprite に各 coding agent CLI と takt を入れて auth 済みの状態にし、ローカルや Routine から `sprite exec` で takt を回す。

本ドキュメントは新規 sprite を 0 から構築する手順。既存 worker が壊れた場合の再構築 runbook としても使う。

## 前提

- sprites.dev アカウント (Fly.io OAuth 経由で作成)
- 利用可能な subscriptions: Claude Max / Codex Plus / Cursor Pro (provider 利用に必要)
- GitHub アカウント (push 権限のあるリポジトリ)
- ローカル環境: macOS/Linux、`mise` (sprite CLI を mise 管理に乗せる場合)

## 1. Sprite CLI を入れる

mise には未登録なので公式インストーラを使う。スクリプトは `~/.local/bin/sprite` にバイナリを置くだけ:

```bash
curl -fsSL https://sprites.dev/install.sh | sh
sprite --version
```

`~/.local/bin` が PATH に入っていることを確認 (zsh/bash の rc に `export PATH="$HOME/.local/bin:$PATH"` 必要なら追加)。

## 2. Fly.io にログインして組織を選択

```bash
sprite login
```

ブラウザで Fly.io OAuth が開く。完了後、組織用 API トークンが CLI 内に保存される (`~/.config/sprite/` 等、CLI 管理)。

```bash
sprite list
# (空) もしくは既存 sprite が表示される
```

## 3. Sprite を作る

```bash
sprite create symphony-worker
sprite use symphony-worker        # current dir のデフォルト sprite に設定
```

スペック (デフォルト): Ubuntu 25.04, x86_64, 8 CPU / 7.8 GB RAM / 99 GB disk。

## 4. 環境を確認

```bash
sprite exec -- bash -lc 'uname -a && nproc && df -h /home && which node python3 go git curl'
```

`/.sprite/bin/` 配下に node / python / go / git / curl / gh / corepack 等が preinstall されている。`/etc/profile.d/languages_env` で `NVM_DIR` 等が設定済み。

## 5. PATH 永続化 (重要)

`npm install -g` の出力先 (`/.sprite/languages/node/nvm/versions/node/<ver>/bin`) は **デフォルトで PATH に入らない**。`bash -lc` で login shell 化したときに見えるよう `~/.profile` に export を書く:

```bash
sprite exec -- bash -lc 'NPM_BIN=$(npm config get prefix)/bin
echo "export PATH=\"$NPM_BIN:\$PATH\"" >> ~/.profile
echo "export PATH=\"$NPM_BIN:\$PATH\"" >> ~/.bashrc'
```

以降の `sprite exec -- bash -lc '...'` でグローバル npm 製コマンドが見える。

## 6. CLI 群をインストール

### pnpm + takt

```bash
sprite exec -- bash -lc 'npm install -g pnpm takt'
sprite exec -- bash -lc 'pnpm --version && takt --version'
```

### Claude Code + Codex CLI

```bash
sprite exec -- bash -lc 'npm install -g @anthropic-ai/claude-code @openai/codex'
sprite exec -- bash -lc 'claude --version && codex --version'
```

### cursor-agent

公式インストーラ (`~/.local/share/cursor-agent/versions/<ver>/` に置かれて `~/.local/bin/cursor-agent` から symlink される):

```bash
sprite exec --tty -- bash -lc 'curl https://cursor.com/install -fsSL | bash'
sprite exec -- bash -lc 'cursor-agent --version'
```

## 7. 各 agent の認証 (interactive)

すべて TTY 経由で対話認証する。`sprite exec --tty -- ...` で sprite 内シェルに繋がる。

> ⚠ いずれも device-flow / OAuth でブラウザ操作が必要。一度 auth すれば `~/.claude` `~/.codex` `~/.cursor` に persistent fs として残るので再認証は不要。

```bash
# Claude Code (Claude Max subscription を使うなら setup-token、API key 直なら ANTHROPIC_API_KEY env)
sprite exec --tty -- bash -lc 'claude setup-token'

# Codex (Codex Plus / API key)
sprite exec --tty -- bash -lc 'codex login'

# Cursor agent
sprite exec --tty -- bash -lc 'cursor-agent login'

# GitHub (web browser device flow)
sprite exec --tty -- bash -lc 'gh auth login'
```

認証情報の保存先 (確認用):

```bash
sprite exec -- bash -lc 'ls ~/.claude/.credentials.json ~/.codex/auth.json ~/.cursor/auth.json && gh auth status'
```

## 8. リポジトリを clone

```bash
sprite exec -- bash -lc 'gh repo clone coji/upflow ~/upflow && cd ~/upflow && pnpm install --frozen-lockfile'
```

`pnpm install` で 20-30 秒程度。lefthook の警告は無視で OK (`pnpm approve-builds` を求めてくるが、sprite 内では git hook 不要)。

## 9. 動作確認 — takt がワークフローを読めるか

```bash
sprite exec -- bash -lc 'cd ~/upflow && takt prompt spec-implement-accept | head -20'
```

`Workflow Prompt Preview: spec-implement-accept` ヘッダ + steps 1〜9 の prompt が出れば OK。

各 agent CLI の headless 疎通も確認:

```bash
sprite exec -- bash -lc 'cd ~/upflow && claude --print "say only: hello"'
sprite exec -- bash -lc 'cd ~/upflow && codex exec "say only: hello"'
sprite exec -- bash -lc 'cd ~/upflow && cursor-agent -p --force "say only: hello"'
```

それぞれ `hello` を返せば認証 + 動作完了。

## 10. Symphony Runner Service の登録

長時間 takt を `sprite exec` 越しに動かすと HTTP/WebSocket 接続が切れる (issue #378 参照)。
そこで `bin/symphony-runner.ts` を sprite 内の Service として常駐させ、外向き poll で sprite を起動させたまま GitHub から `symphony:ready` issue を拾わせる。

### Service の登録

```bash
sprite api -X PUT /v1/sprites/symphony-worker/services/symphony-runner \
  -H 'Content-Type: application/json' \
  -d '{
    "cmd": "bash",
    "args": ["-lc", "cd ~/upflow && git pull --ff-only --quiet && pnpm install --frozen-lockfile --silent && pnpm symphony:run"]
  }'
```

### 起動

```bash
sprite api -X POST /v1/sprites/symphony-worker/services/symphony-runner/start
```

### ログ確認

```bash
sprite api /v1/sprites/symphony-worker/services/symphony-runner/logs?lines=200
```

### 停止

```bash
sprite api -X POST /v1/sprites/symphony-worker/services/symphony-runner/stop
```

### Service が落ちた場合

Service は sprite が wake する際に auto-restart される (sprites.dev の Service 仕様)。
manual restart したい場合は上記 `start` を再実行。

## 11. メンテナンス

### CLI の更新

```bash
sprite exec -- bash -lc 'npm update -g pnpm takt @anthropic-ai/claude-code @openai/codex'
sprite exec --tty -- bash -lc 'curl https://cursor.com/install -fsSL | bash'    # cursor-agent は再 install 上書き
```

### 認証の再取得 (subscription token expire 時)

該当 CLI の login コマンドを再実行 (上記 §7 と同じ)。

### sprite を一旦 idle に

何も叩かないでいると自動で pause、課金は filesystem 分のみ (~$0.000683/GB-時間)。`sprite list` で状態確認可。

### sprite を破棄して作り直す

```bash
sprite destroy -s symphony-worker
# 上記 §3〜9 を再実行
```

## 検証済み環境 (2026-05 時点)

| 項目         | バージョン          |
| ------------ | ------------------- |
| sprite CLI   | v0.0.1-rc43         |
| node         | v22.20.0 (NVM 経由) |
| pnpm         | 10.33.2             |
| takt         | 0.39.0              |
| Claude Code  | 2.1.92+             |
| Codex CLI    | 0.118.0+            |
| cursor-agent | 2026.05.01-eea359f  |
| gh           | 2.79.0              |

## 関連

- issue #370 (Symphony port 親 issue)
- issue #371 (この runbook の作成 issue = M1a)
- [sprites.dev docs](https://docs.sprites.dev/)
- [Symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
