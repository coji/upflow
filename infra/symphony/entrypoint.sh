#!/bin/bash
# Symphony container entrypoint.
# Runs on every Fly machine boot. Restores HOME to the Volume so subscription
# tokens survive restarts, ensures the upflow checkout is present and
# up-to-date, and hands off to the HTTP server.

set -euo pipefail

REPO_DIR="${SYMPHONY_REPO_DIR:-/data/upflow}"
# Force HOME to the Volume unconditionally. The Dockerfile sets
# `ENV HOME=/data/home`, but we re-exec across `gosu symphony` and the
# child saw a different HOME in practice (auth check failed even though
# /data/home/.config/gh/hosts.yml was on disk). Hard-coding here, plus
# explicit `env HOME=...` on the gosu line below, removes the ambiguity.
HOME_DIR=/data/home

# Root path: fix Volume ownership and re-exec self as symphony (uid 1001).
# `flyctl ssh console` defaults to root, so any `gh auth login` from SSH
# writes auth files under /data/home owned by root. Without this chown,
# the symphony user can't read them and the server crash-loops on every
# boot. Fixing perms here makes the wrong SSH user a transient mistake
# instead of a stuck state.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$HOME_DIR"
  chown -R symphony:symphony /data
  exec gosu symphony env HOME="$HOME_DIR" "$0" "$@"
fi

mkdir -p "$HOME_DIR"
export HOME="$HOME_DIR"

# HOME=/data/home is locked in via three independent paths — drop any one
# and the auth-check below silently looks at the wrong directory:
#   1. /etc/profile.d/symphony-home.sh — for `flyctl ssh console` sessions
#   2. HOME_DIR=/data/home above       — for this script's own logic
#   3. `env HOME=...` on the gosu line — for the root → symphony hand-off
# All three are intentional belt-and-suspenders; see PR #386 for context.

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
