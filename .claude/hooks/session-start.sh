#!/usr/bin/env bash

# Session Start Hook — State Summary & Gap Detection
#
# Runs on every session start. Shows:
# 1. Previous session state from HANDOFF.md
# 2. Uncommitted changes warning
# 3. Basic gap detection (missing tests, stale changelog)
#
# Keep output SHORT — max 10 lines.

set -euo pipefail

OUTPUT=""

# 1. HANDOFF.md summary
if [ -f "HANDOFF.md" ]; then
  BRANCH=$(grep -A1 "## Current State" HANDOFF.md 2>/dev/null | grep "Branch" | sed 's/.*`\(.*\)`.*/\1/' || echo "unknown")
  STATUS=$(grep -A2 "## Current State" HANDOFF.md 2>/dev/null | grep "Status" | sed 's/.*\*\*Status:\*\* //' || echo "unknown")
  NEXT=$(grep -A1 "## Next Steps" HANDOFF.md 2>/dev/null | grep "^\- \[" | head -1 | sed 's/^- \[ \] //' || echo "none")
  OUTPUT="${OUTPUT}📋 Previous session: ${BRANCH} (${STATUS}) | Next: ${NEXT}\n"
else
  OUTPUT="${OUTPUT}🆕 Fresh session — no HANDOFF.md found\n"
fi

# 2. Uncommitted changes
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  UNCOMMITTED=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
  if [ "$UNCOMMITTED" -gt 0 ]; then
    OUTPUT="${OUTPUT}⚠️ ${UNCOMMITTED} uncommitted changes\n"
  fi
fi

# 3. Gap detection (lightweight)
if [ -d "backend/src" ] && [ -d "backend/tests" ]; then
  SRC_COUNT=$(find backend/src -name "*.py" -not -name "__init__.py" 2>/dev/null | wc -l | tr -d ' ')
  TEST_COUNT=$(find backend/tests -name "test_*.py" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SRC_COUNT" -gt 0 ] && [ "$TEST_COUNT" -eq 0 ]; then
    OUTPUT="${OUTPUT}🔴 ${SRC_COUNT} source files but 0 test files\n"
  elif [ "$SRC_COUNT" -gt 0 ] && [ "$((TEST_COUNT * 3))" -lt "$SRC_COUNT" ]; then
    OUTPUT="${OUTPUT}⚠️ Test coverage low: ${TEST_COUNT} tests for ${SRC_COUNT} source files\n"
  fi
fi

# 4. Stale changelog check
if [ -f "docs/CHANGELOG.md" ] && command -v git &>/dev/null; then
  LAST_CHANGELOG=$(git log -1 --format="%ar" -- docs/CHANGELOG.md 2>/dev/null || echo "never")
  LAST_COMMIT=$(git log -1 --format="%ar" 2>/dev/null || echo "never")
  if [ "$LAST_CHANGELOG" != "$LAST_COMMIT" ]; then
    COMMITS_SINCE=$(git log --oneline -- . ':!docs/CHANGELOG.md' 2>/dev/null | head -5 | wc -l | tr -d ' ')
    if [ "$COMMITS_SINCE" -gt 2 ]; then
      OUTPUT="${OUTPUT}⚠️ CHANGELOG.md not updated in last ${COMMITS_SINCE} commits\n"
    fi
  fi
fi

# Output (only if there's something to say)
if [ -n "$OUTPUT" ]; then
  printf "%b" "$OUTPUT"
fi
