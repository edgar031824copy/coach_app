#!/usr/bin/env bash
# Stop hook: the harness, not the model, decides the work is not done (workflow §11, G2).
# Runs typecheck and tests when code changed. Exit 2 blocks finishing; CI stays the final gate.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 0
[ -f package.json ] || exit 0   # nothing to run until E1 scaffolds the project

# Only when code changed (docs, specs and harness-only changes do not need a test run).
changed="$(git status --porcelain 2>/dev/null | awk '{print $NF}' | grep -vE '^(docs/|openspec/|\.claude/|README\.md|CLAUDE\.md|prd-)' || true)"
[ -n "$changed" ] || exit 0

out="$( { npm run typecheck --workspaces --if-present && npm test --workspaces --if-present; } 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  echo "Typecheck or tests failed. Fix them before finishing (last 40 lines):" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
