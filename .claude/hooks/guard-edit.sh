#!/usr/bin/env bash
# PreToolUse (Edit|Write|NotebookEdit): scope freeze + protect canonical specs (workflow §11).
# Exit 2 blocks the edit and shows stderr to the model.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
command -v jq >/dev/null 2>&1 || { echo "BLOCKED: jq is not installed, so the edit guard cannot check this edit. Install jq (brew install jq)." >&2; exit 2; }
input="$(cat)"
path="$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
[ -n "$path" ] || exit 0
rel="${path#"$ROOT"/}"
phase="$("$ROOT/scripts/phase" get phase 2>/dev/null || true)"
change="$("$ROOT/scripts/phase" get change 2>/dev/null || true)"

# The phase file is written only by scripts/phase.
if [[ "$rel" == "docs/.phase" ]]; then
  echo "BLOCKED: docs/.phase is written only by scripts/phase, never by an edit." >&2
  exit 2
fi

# Canonical specs change only through sync/archive.
if [[ "$rel" == openspec/specs/* && "$phase" != "archiving" ]]; then
  echo "BLOCKED: openspec/specs/ is never edited by hand. It changes only through /opsx:sync or /opsx:archive (phase 'archiving'). Current phase: '${phase:-none}'." >&2
  exit 2
fi

# Scope freeze: once the change is approved, its proposal, design and specs are frozen. tasks.md stays editable.
if [[ -n "$change" && "$phase" =~ ^(approved|building|verifying)$ ]]; then
  if [[ "$rel" == "openspec/changes/$change/proposal.md" || "$rel" == "openspec/changes/$change/design.md" || "$rel" == "openspec/changes/$change/specs/"* ]]; then
    echo "BLOCKED: scope is frozen for '$change' (phase '$phase'). Edits to proposal.md, design.md and specs/ need a NEW change (CLAUDE.md rule 2). tasks.md is still editable. Typos or obvious compile errors: the owner runs 'scripts/phase set phase=defining' first (the deny rules stop the model from doing it)." >&2
    exit 2
  fi
fi
exit 0
