#!/usr/bin/env bash
# Runs on SessionStart — detects project gaps and shows session state
# Output is kept SHORT (max 10 lines) to avoid noise on every session.

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUTPUT=""

# 1. Check HANDOFF.md
if [[ -f "$PROJECT_ROOT/HANDOFF.md" ]]; then
  STATUS=$(grep -m1 '^\- \*\*Status:\*\*' "$PROJECT_ROOT/HANDOFF.md" 2>/dev/null | sed 's/.*\*\*Status:\*\* *//' || echo "unknown")
  NEXT=$(grep -m1 '^\- \[ \]' "$PROJECT_ROOT/HANDOFF.md" 2>/dev/null | sed 's/- \[ \] //' || echo "none listed")
  OUTPUT+="HANDOFF: ${STATUS} | Next: ${NEXT}"$'\n'
else
  OUTPUT+="HANDOFF: not found (fresh session)"$'\n'
fi

# 2. Test-to-source ratio check
if [[ -d "$PROJECT_ROOT/backend/src" ]]; then
  SRC_COUNT=$(find "$PROJECT_ROOT/backend/src" -name '*.py' -not -name '__init__.py' 2>/dev/null | wc -l | tr -d ' ')
  TEST_COUNT=$(find "$PROJECT_ROOT/backend/tests" -name 'test_*.py' 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$SRC_COUNT" -gt 0 && "$TEST_COUNT" -gt 0 ]]; then
    RATIO=$(( (TEST_COUNT * 100) / SRC_COUNT ))
    if [[ "$RATIO" -lt 50 ]]; then
      OUTPUT+="WARN: test coverage ratio low — ${TEST_COUNT} tests for ${SRC_COUNT} source files (${RATIO}%)"$'\n'
    fi
  elif [[ "$SRC_COUNT" -gt 0 && "$TEST_COUNT" -eq 0 ]]; then
    OUTPUT+="WARN: no test files found for ${SRC_COUNT} backend source files"$'\n'
  fi
fi

# 3. CHANGELOG staleness check
if [[ -d "$PROJECT_ROOT/.git" ]]; then
  CHANGELOG="$PROJECT_ROOT/docs/CHANGELOG.md"
  if [[ -f "$CHANGELOG" ]]; then
    RECENT_COMMITS=$(git -C "$PROJECT_ROOT" log --oneline -3 2>/dev/null | wc -l | tr -d ' ')
    CHANGELOG_IN_RECENT=$(git -C "$PROJECT_ROOT" log --oneline -3 --diff-filter=M -- docs/CHANGELOG.md 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$RECENT_COMMITS" -gt 0 && "$CHANGELOG_IN_RECENT" -eq 0 ]]; then
      OUTPUT+="WARN: CHANGELOG.md not updated in last 3 commits"$'\n'
    fi
  fi
fi

# 4. Uncommitted changes summary
if [[ -d "$PROJECT_ROOT/.git" ]]; then
  STAGED=$(git -C "$PROJECT_ROOT" diff --cached --stat 2>/dev/null | tail -1 | tr -d ' ')
  UNSTAGED=$(git -C "$PROJECT_ROOT" diff --stat 2>/dev/null | tail -1 | tr -d ' ')
  UNTRACKED=$(git -C "$PROJECT_ROOT" ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
  if [[ -n "$STAGED" || -n "$UNSTAGED" || "$UNTRACKED" -gt 0 ]]; then
    PARTS=""
    [[ -n "$STAGED" ]] && PARTS+="staged: ${STAGED}"
    [[ -n "$UNSTAGED" ]] && PARTS+="${PARTS:+, }unstaged: ${UNSTAGED}"
    [[ "$UNTRACKED" -gt 0 ]] && PARTS+="${PARTS:+, }${UNTRACKED} untracked"
    OUTPUT+="GIT: uncommitted changes — ${PARTS}"$'\n'
  fi
fi

# Print output (only if there is something to report)
if [[ -n "$OUTPUT" ]]; then
  echo "--- Session Start Check ---"
  echo -n "$OUTPUT"
  echo "---"
fi
