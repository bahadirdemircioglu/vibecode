#!/usr/bin/env bash
# Runs a node hook script. Without node the hook is skipped (exit 0) instead of
# failing on every tool call — session-start.sh reports the MISSING node line.
command -v node >/dev/null 2>&1 || exit 0
exec node "$@"
