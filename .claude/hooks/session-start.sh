#!/usr/bin/env bash
# SessionStart: print where we are, so a new session does not reread everything (workflow §10).
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
echo "coach_app state (docs/.phase): $("$ROOT/scripts/phase" show 2>/dev/null)"
if command -v openspec >/dev/null 2>&1; then
  echo "--- openspec list ---"
  (cd "$ROOT" && openspec list 2>/dev/null)
fi
exit 0
