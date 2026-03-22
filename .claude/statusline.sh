#!/usr/bin/env bash

# Status Line — Dynamic Context Breadcrumb
#
# Shows: context usage % | model | project stage | current task
# Input: JSON on stdin from Claude Code
#
# Source pattern: Claude Code Game Studios statusline.sh

set -euo pipefail

# Read JSON from stdin
INPUT=$(cat)

# Extract context usage percentage
CTX_USED=$(echo "$INPUT" | grep -o '"percent_used":[0-9.]*' | head -1 | cut -d: -f2 2>/dev/null || echo "?")
if [ "$CTX_USED" != "?" ]; then
  CTX_INT=$(printf "%.0f" "$CTX_USED" 2>/dev/null || echo "$CTX_USED")
  CTX="ctx:${CTX_INT}%"
else
  CTX="ctx:?"
fi

# Extract model name
MODEL=$(echo "$INPUT" | grep -o '"model":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || echo "unknown")
# Shorten model name
case "$MODEL" in
  *opus*) MODEL_SHORT="Opus" ;;
  *sonnet*) MODEL_SHORT="Sonnet" ;;
  *haiku*) MODEL_SHORT="Haiku" ;;
  *) MODEL_SHORT="$MODEL" ;;
esac

# Detect project stage from docs/VERSION if available
STAGE="dev"
if [ -f "docs/VERSION" ]; then
  VERSION=$(cat docs/VERSION 2>/dev/null || echo "0.0.0")
  case "$VERSION" in
    0.0.*|0.1.*) STAGE="setup" ;;
    0.*) STAGE="dev" ;;
    1.0.0-*) STAGE="pre-release" ;;
    *) STAGE="v${VERSION}" ;;
  esac
fi

# Get current task from HANDOFF.md if available
TASK=""
if [ -f "HANDOFF.md" ]; then
  TASK=$(grep -A1 "## Current State" HANDOFF.md 2>/dev/null | tail -1 | sed 's/^- \*\*Branch:\*\* //' | sed 's/`//g' | head -c 30 || true)
fi

# Build status line
if [ -n "$TASK" ]; then
  echo "${CTX} | ${MODEL_SHORT} | ${STAGE} | ${TASK}"
else
  echo "${CTX} | ${MODEL_SHORT} | ${STAGE}"
fi
