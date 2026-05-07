#!/bin/bash
# cursor-agent shim: intercepts the buggy `cleanup-install-versions`
# subcommand that cursor-agent's auto-update spawns as a detached child
# (see https://github.com/coji/upflow/pull/<this PR>).
#
# Symptom: each cursor-agent invocation triggers
#   spawn(<binary>, ["cleanup-install-versions", "<version>"], {detached:true})
# from cursor-agent's internal install/update path. The intent is to
# remove stale install version dirs deterministically. In practice the
# child process falls through to agent mode and treats
# "cleanup-install-versions <version>" as a user prompt — the composer
# model then greps the codebase, finds CURSOR_AGENT_VERSION in
# `infra/symphony/Dockerfile`, and "improves" it. This generated
# out-of-scope edits during issue #399's takt run that acceptance kept
# rejecting (see SHIM_VERSION marker below).
#
# This shim no-ops cleanup-install-versions (sacrificing the legitimate
# cleanup; stale install dirs leak in HOME but never accumulate beyond
# a few MB) and proxies all other invocations to the real binary saved
# at `<this-path>.real`.
#
# SHIM_VERSION=cursor-cleanup-noop
set -eu

if [ "${1:-}" = "cleanup-install-versions" ]; then
  exit 0
fi

exec "$0.real" "$@"
