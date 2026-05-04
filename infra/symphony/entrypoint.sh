#!/bin/bash
# Symphony container entrypoint.
# Runs on every Fly machine boot. Restores HOME to the Volume so subscription
# tokens survive restarts, ensures the upflow checkout is present and
# up-to-date, and hands off to the HTTP server.

set -euo pipefail

REPO_DIR="${SYMPHONY_REPO_DIR:-/data/upflow}"
HOME_DIR="${HOME:-/data/home}"

mkdir -p "$HOME_DIR"
export HOME="$HOME_DIR"

# Persist sprite-style auth + git config under the Volume so first-boot
# `gh auth login` / `claude auth login` etc. via SSH stay valid across
# machine restarts and image redeploys.

if [ ! -f "$HOME/.config/gh/hosts.yml" ]; then
  echo "[entrypoint] gh is not authenticated yet."
  echo "[entrypoint] flyctl ssh console into this machine and run:"
  echo "[entrypoint]   gh auth login"
  echo "[entrypoint]   claude auth login --claudeai"
  echo "[entrypoint]   codex login"
  echo "[entrypoint]   cursor-agent login"
  echo "[entrypoint] then 'flyctl machine restart' to drop into the server."
  echo "[entrypoint] sleeping so the machine stays up for ssh access..."
  exec sleep infinity
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[entrypoint] cloning coji/upflow into $REPO_DIR"
  gh repo clone coji/upflow "$REPO_DIR"
fi

cd "$REPO_DIR"
git fetch --quiet origin main
git checkout main --quiet
git reset --hard origin/main --quiet
pnpm install --frozen-lockfile --silent

exec pnpm symphony:serve
