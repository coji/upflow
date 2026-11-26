#!/usr/bin/env bash
# Model-check the crawl scan watermark (see .agents/skills/verify-crawl-watermark/SKILL.md).
#
#   verification/crawl-watermark/check.sh             # every model
#   verification/crawl-watermark/check.sh code        # one model by name
#   verification/crawl-watermark/check.sh --accept    # every model, then record that the
#                                                     # model describes the covered code now
#
# Exit codes:
#   0  every model gave its expected result, and the covered code is the confirmed version
#   1  a model gave an unexpected result
#   2  the model cannot be run against this code (tools, or a switch string not found)
#   3  every model gave its expected result, but the covered code changed since it was
#      last confirmed: the result is unconfirmed until someone checks the model against it
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

# Last confirmation that the model describes the covered code.
SYNC_COMMIT=be21c2ac
SYNC_HASH=82fb1372d9960f8c
COVERED=(
  app/services/jobs/crawl.server.ts
  app/services/jobs/scan-watermark.ts
  app/services/jobs/concurrency-keys.server.ts
  app/services/durably.server.ts
  app/services/github-webhook-pull.server.ts
  'app/routes/$orgSlug/settings/repositories.add/index.tsx'
  'app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx'
  batch/job-scheduler.ts
  batch/github/fetcher.ts
  batch/github/store.ts
)
DURABLY_VERSION=0.16.1

# Pinned tools.
JAVA="java@temurin-21.0.13+9.0.LTS"
TLA_VERSION=1.7.4
TLA_SHA256=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
JAR="$ROOT/.cache/tla/tla2tools-$TLA_VERSION.jar"

# name=expected: "pass", or the invariant that TLC must report as violated.
MODELS=(
  "code=pass"
  "code-page-refresh=pass"
  "code-second-worker=pass"
  "finding-same-second=Converged"
  "finding-page-refresh=RawNeverGoesBack"
  "finding-second-worker=RawNeverGoesBack"
  "finding-partial-list=Converged"
  "mutant-advance-on-failure=Converged"
  "mutant-targeted-advances=Converged"
)

accept=0
only=""
for arg in "$@"; do
  case "$arg" in
    --accept) accept=1 ;;
    *) only="$arg" ;;
  esac
done

covered_hash() { cat "${COVERED[@]}" | shasum -a 256 | cut -c1-16; }

# ---------------------------------------------------------------------------
# Read the code switches from the code. A switch with a FALSE string is TRUE
# or FALSE by which string the file holds; when neither is found, the code
# changed in a way the model does not know, so stop. A guard switch (no FALSE
# string) is FALSE when its string is gone: the model then runs without the
# guard, and a moved guard shows up as a failing model, never as a silent pass.
switch_value() { # name file true-string false-string
  local name=$1 file=$2 t=$3 f=$4
  if grep -qF -- "$t" "$file"; then echo TRUE
  elif [[ -n "$f" ]] && grep -qF -- "$f" "$file"; then echo FALSE
  elif [[ -z "$f" ]]; then
    echo "NOTE: $name: guard not found in $file, modeled as missing:" >&2
    echo "  $t" >&2
    echo FALSE
  else
    echo "MODEL OUT OF DATE: $name: neither form found in $file" >&2
    echo "  TRUE form:  $t" >&2
    echo "  FALSE form: $f" >&2
    echo "  Re-read $file, update CrawlWatermark.tla and the strings in check.sh." >&2
    exit 2
  fi
}
StopInclusive=$(switch_value StopInclusive batch/github/fetcher.ts \
  '? (node) => node.updatedAt <= stopBefore' '? (node) => node.updatedAt < stopBefore')
AdvanceNeedsAllSaved=$(switch_value AdvanceNeedsAllSaved app/services/jobs/scan-watermark.ts \
  'if (!savedPrNumbers.has(pr.number)) return null' '')
TargetedNeverAdvances=$(switch_value TargetedNeverAdvances app/services/jobs/scan-watermark.ts \
  'if (isTargetedFetch) return null' '')
SaveGuard=$(switch_value SaveGuard batch/github/store.ts \
  ".whereRef('excluded.fetchedAt', '>=', 'githubRawData.fetchedAt')" '')
echo "Code switches: StopInclusive=$StopInclusive AdvanceNeedsAllSaved=$AdvanceNeedsAllSaved TargetedNeverAdvances=$TargetedNeverAdvances SaveGuard=$SaveGuard"

installed_durably=$(node -p "require('./node_modules/@coji/durably/package.json').version" 2>/dev/null || echo unknown)
if [[ "$installed_durably" != "$DURABLY_VERSION" ]]; then
  echo "NOTE: @coji/durably is $installed_durably, the model follows $DURABLY_VERSION."
  echo "  Re-read node_modules/@coji/durably/docs/llms.md (coalesce, maxConcurrentRuns) and check Trigger and CrawlStarts."
fi

# ---------------------------------------------------------------------------
# Tools
if [[ ! -f "$JAR" ]]; then
  mkdir -p "$(dirname "$JAR")"
  curl -fsSL -o "$JAR.tmp" "https://github.com/tlaplus/tlaplus/releases/download/v$TLA_VERSION/tla2tools.jar"
  mv "$JAR.tmp" "$JAR"
fi
echo "$TLA_SHA256  $JAR" | shasum -a 256 -c --status || { echo "tla2tools.jar checksum mismatch: $JAR" >&2; exit 2; }
mise install -q "$JAVA" >/dev/null

OUT="$ROOT/tmp/crawl-watermark"
mkdir -p "$OUT"
META="$(mktemp -d)"
trap 'rm -rf "$META"' EXIT

failed=0
for entry in "${MODELS[@]}"; do
  name=${entry%%=*}; expect=${entry#*=}
  [[ -n "$only" && "$only" != "$name" ]] && continue
  sed -e "s/@StopInclusive@/$StopInclusive/" \
      -e "s/@AdvanceNeedsAllSaved@/$AdvanceNeedsAllSaved/" \
      -e "s/@TargetedNeverAdvances@/$TargetedNeverAdvances/" \
      -e "s/@SaveGuard@/$SaveGuard/" \
      "$HERE/models/$name.cfg.in" > "$OUT/$name.cfg"
  start=$SECONDS
  (cd "$HERE" && mise exec "$JAVA" -- java -XX:+UseParallelGC -cp "$JAR" tlc2.TLC \
      -workers auto -metadir "$META/$name" -config "$OUT/$name.cfg" CrawlWatermark.tla) \
      > "$OUT/$name.out" 2>&1 || true
  if grep -q "No error has been found" "$OUT/$name.out"; then got=pass
  elif v=$(grep -oE "Invariant [A-Za-z]+ is violated" "$OUT/$name.out" | head -1); [[ -n "$v" ]]; then
    got=$(echo "$v" | awk '{print $2}')
  else got=error
  fi
  states=$(grep -oE "[0-9,]+ distinct states found" "$OUT/$name.out" | tail -1 || true)
  if [[ "$got" == "$expect" ]]; then
    printf 'ok    %-26s %-17s %4ss  %s\n' "$name" "$got" "$((SECONDS - start))" "$states"
  else
    failed=1
    printf 'FAIL  %-26s expected %s, got %s  (tmp/crawl-watermark/%s.out)\n' "$name" "$expect" "$got" "$name"
  fi
done
echo "TLC configs and output: tmp/crawl-watermark/<model>.cfg and .out"
echo

[[ $failed -ne 0 ]] && exit 1

if [[ $accept -eq 1 ]]; then
  if [[ -n "$only" ]]; then echo "--accept needs every model; run it without a model name." >&2; exit 2; fi
  head_commit=$(git rev-parse --short HEAD)
  hash=$(covered_hash)
  sed -i.bak -e "s/^SYNC_COMMIT=.*/SYNC_COMMIT=$head_commit/" -e "s/^SYNC_HASH=.*/SYNC_HASH=$hash/" "$0"
  rm -f "$0.bak"
  echo "Recorded: SYNC_COMMIT=$head_commit SYNC_HASH=$hash. Update the sync section of SKILL.md to $head_commit."
  if ! git diff --quiet HEAD -- "${COVERED[@]}"; then
    echo "NOTE: the covered files have uncommitted changes. SYNC_HASH covers them; SYNC_COMMIT=$head_commit does not."
  fi
  exit 0
fi

if [[ "$(covered_hash)" == "$SYNC_HASH" ]]; then
  echo "Covered code is the version last confirmed against the model ($SYNC_COMMIT)."
  exit 0
fi
echo "UNCONFIRMED: the covered code changed since the model was last confirmed ($SYNC_COMMIT)."
echo "The models ran as expected, but they may no longer describe the code. Changes:"
git --no-pager diff --stat "$SYNC_COMMIT" -- "${COVERED[@]}" || true
echo "Check each change against the coverage table in SKILL.md, then run with --accept."
exit 3
