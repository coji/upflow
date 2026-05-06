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
PNPM_STORE_VOLUME="upflow-symphony-preflight-pnpm-store"

echo "[host] building image $IMAGE_TAG"
docker build \
  --quiet \
  -f "$REPO_ROOT/infra/symphony/Dockerfile" \
  -t "$IMAGE_TAG" \
  "$REPO_ROOT"

# Cache the clean HEAD checkout under $TMPDIR so repeat runs at the same
# SHA skip the re-export. Only invalidate when the SHA changes.
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
CACHE_ROOT="${TMPDIR:-/tmp}/symphony-preflight-cache"
CHECKOUT="$CACHE_ROOT/$HEAD_SHA"
if [ ! -d "$CHECKOUT" ]; then
  echo "[host] exporting clean HEAD checkout ($HEAD_SHA) to $CHECKOUT"
  mkdir -p "$CHECKOUT"
  git -C "$REPO_ROOT" archive HEAD | tar -x -C "$CHECKOUT"
else
  echo "[host] reusing cached checkout $CHECKOUT"
fi

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
#
# Persist the pnpm content-addressed store in a named volume so repeat
# runs hit the cache instead of re-fetching every package. First run
# is unchanged (~1-2 min), subsequent runs drop to ~10s on install.
#
# Stage commands below MUST stay in lockstep with `bin/symphony-serve.ts`
# `runTakt` `preflightStages`. There's no shared definition yet — see
# the cross-reference comment there.
#
# Intentional asymmetry: the production preflight has a `cursor state
# reset` stage that wipes `/data/home/.cursor/`. We do NOT mirror it
# here because the local preflight uses a throwaway docker container
# with no persistent /data/home — there's no leftover cursor state to
# clean. Adding it would just be a no-op rm that masks the actual
# coverage gap.
echo "[host] running preflight stages inside $IMAGE_TAG"
docker run --rm \
  --entrypoint bash \
  -v "$CHECKOUT:/data/upflow" \
  --mount "type=volume,src=$PNPM_STORE_VOLUME,dst=/data/home/.local/share/pnpm/store" \
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
