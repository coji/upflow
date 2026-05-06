#!/usr/bin/env bash
# Run the symphony preflight stages inside a freshly built copy of the
# symphony container image, using a clean git archive of HEAD (no local
# node_modules pollution), with the same env vars fly.toml will pass in
# production.
#
# Use this before `git push` on any change under infra/symphony/** to
# catch env-dep gaps (missing binaries, unset env vars, broken scripts)
# without going through the deploy → fail → fix → redeploy loop. We've
# burned that loop more than once — see issues #400 (atlas not in image)
# and #405 (UPFLOW_DATA_DIR + dotenv schema vars).
#
# Requires: docker (or OrbStack), git.
# Run from anywhere inside the repo: `pnpm symphony:preflight:check`

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
IMAGE_TAG="upflow-symphony-preflight:latest"
TMP="$(mktemp -d -t symphony-preflight-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

echo "[host] building image $IMAGE_TAG"
docker build \
  --quiet \
  -f "$REPO_ROOT/infra/symphony/Dockerfile" \
  -t "$IMAGE_TAG" \
  "$REPO_ROOT"

echo "[host] exporting clean HEAD checkout to $TMP"
git -C "$REPO_ROOT" archive HEAD | tar -x -C "$TMP"

# Mirror infra/symphony/fly.toml [env] block. Keep this list in sync —
# anything that's required at app boot (validated by
# app/libs/dotenv.server.ts) needs both a fly.toml entry AND a line
# here.
ENV_ARGS=(
  -e UPFLOW_DATA_DIR=/data/upflow/data
  -e BETTER_AUTH_URL=http://localhost:8080
  -e BETTER_AUTH_SECRET=symphony-preflight-dummy-secret-32+chars-not-a-real-secret
  -e GITHUB_CLIENT_ID=symphony-dummy
  -e GITHUB_CLIENT_SECRET=symphony-dummy
)

# `--entrypoint bash` overrides the image's tini -> entrypoint.sh chain.
# entrypoint.sh treats trailing args as the SSH-prep cue and goes to
# `sleep infinity` if gh isn't authenticated, which traps the run
# forever. We only want the preflight commands, not the server bring-up.
echo "[host] running preflight stages inside $IMAGE_TAG"
docker run --rm \
  --entrypoint bash \
  -v "$TMP:/data/upflow" \
  "${ENV_ARGS[@]}" \
  "$IMAGE_TAG" \
  -c '
    set -e
    cd /data/upflow
    echo "::group::stage 1 — pnpm install"
    pnpm install --frozen-lockfile --silent
    echo "::endgroup::"
    echo "::group::stage 2 — pnpm db:setup"
    pnpm db:setup
    echo "::endgroup::"
    echo "::group::stage 3 — pnpm typecheck"
    pnpm typecheck
    echo "::endgroup::"
    echo "[ok] all preflight stages passed"
  '
