#!/usr/bin/env bash
# Stop hook: the harness, not the model, decides the work is not done (workflow §11, G2).
# Runs typecheck and tests when code changed. Exit 2 blocks finishing; CI stays the final gate.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 0
[ -f package.json ] || exit 0   # nothing to run until E1 scaffolds the project

# Only when code changed, committed or not: compare with the merge-base, plus untracked files.
# (Without this, committing per task would leave the working tree clean and skip the run.)
base="$(git merge-base HEAD origin/master 2>/dev/null || git rev-parse HEAD 2>/dev/null)"
changed="$( { git diff --name-only "$base" 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | grep -vE '^(docs/|openspec/|\.claude/|scripts/|README\.md|CLAUDE\.md|prd-)' || true)"
[ -n "$changed" ] || exit 0

# npm refuses --workspaces when none are declared (before E1 task 1.x sets them up).
ws=""
[ "$(npm pkg get workspaces 2>/dev/null)" != "{}" ] && ws="--workspaces"

out="$( { npm run typecheck $ws --if-present && npm test $ws --if-present; } 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  echo "Typecheck or tests failed. Fix them before finishing (last 40 lines):" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
