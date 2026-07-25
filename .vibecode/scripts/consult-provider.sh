#!/usr/bin/env bash
# consult-provider.sh — send an architecture plan to an external AI provider
# (v1: DeepSeek) for a critique pass. This is the MECHANICAL half of /vibe-plan
# Step 1.5 "consultation": ONE request, ONE response. The multi-round convergence
# LOOP lives in the /vibe-plan orchestration, not here — this script is stateless
# and round-agnostic (see docs/architecture/multi-ai-plan-consultation-plan.md).
#
# Usage:
#   consult-provider.sh <plan-file-path> [--exclude-appendix]
#
#   --exclude-appendix   strip everything from the first
#                        "## Appendix: External Review" heading to EOF before
#                        sending (round 2+: don't feed the provider its own prior
#                        output back as plan content).
#
# Contract (what the orchestration observes):
#   exit 0 + stdout      = provider critique (markdown)          → consultation OK
#   exit 0 + empty stdout= disabled / no config / no key         → SILENT skip
#   exit 1 + stderr      = error (missing dep / timeout / HTTP)  → ADVISORY skip
#
# This script NEVER fails the /vibe-plan flow: the caller treats a non-zero exit
# as "skip consultation, continue with the plan as-is" (fail-open — this is an
# optional quality step, not a security gate; cf. the fail-CLOSED security hooks
# in .claude/hooks/, security.md §7).
#
# API key handling (security.md §8):
#   The key is read from the env var named by the provider's `api_key_env`
#   (default DEEPSEEK_API_KEY). If that var is unset and a root .env exists, ONLY
#   that single key line is extracted from it — no `source`/`eval`, so .env is
#   never executed. The key travels solely in the curl Authorization header and is
#   NEVER written to stdout/stderr. This preserves the intent of the settings.json
#   .env deny-list (which stops Claude reading .env into its own context): the key
#   stays inside this subprocess and never reaches the model.
#
# Referenced by: .claude/commands/vibe-plan.md (Step 1.5), security.md §8.
# Exit codes: 0 ok/skip · 1 advisory error.

set -uo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CONFIG="$PROJECT_ROOT/.vibecode/config/ai-providers.json"

PLAN_FILE="${1:-}"
EXCLUDE_APPENDIX=0
[[ "${2:-}" == "--exclude-appendix" ]] && EXCLUDE_APPENDIX=1

# Fixed critique prompt (system role). Kept generic so it works for any provider.
CRITIQUE_PROMPT="You are a senior software architect performing a critical peer review of another AI's architecture plan. Identify gaps, hidden risks, incorrect assumptions, missing edge cases, and better alternatives. Be concise and specific: respond as a short bulleted list grouped by severity (Blocking / Should-fix / Nice-to-have). Do NOT rewrite the plan and do NOT write code — give feedback only. If the plan is already sound, say so plainly and list only minor points."

skip() { exit 0; }                          # silent skip: disabled / no config / no key
fail() { echo "consult: $*" >&2; exit 1; }  # advisory skip: real error

# ---- preconditions ---------------------------------------------------------
[[ -n "$PLAN_FILE" ]] || fail "no plan file argument"
[[ -f "$PLAN_FILE" ]] || fail "plan file not found: $PLAN_FILE"
[[ -f "$CONFIG"    ]] || skip               # feature not configured → silent skip
command -v jq   >/dev/null 2>&1 || fail "jq not found (required to build/parse request)"
command -v curl >/dev/null 2>&1 || fail "curl not found"

# ---- read config -----------------------------------------------------------
active="$(jq -r '.active_provider // empty' "$CONFIG" 2>/dev/null)"
[[ -n "$active" ]] || skip
enabled="$(jq -r --arg p "$active" '.providers[$p].enabled // false' "$CONFIG" 2>/dev/null)"
[[ "$enabled" == "true" ]] || skip          # opt-in gate: disabled → silent skip

shape="$(jq -r --arg p "$active" '.providers[$p].request_shape // "openai-compatible"' "$CONFIG" 2>/dev/null)"
[[ "$shape" == "openai-compatible" ]] || \
  fail "request_shape '$shape' not implemented (v1 supports openai-compatible only)"

base_url="$(jq -r --arg p "$active" '.providers[$p].base_url // empty' "$CONFIG" 2>/dev/null)"
chat_path="$(jq -r --arg p "$active" '.providers[$p].chat_path // "/chat/completions"' "$CONFIG" 2>/dev/null)"
model="$(jq -r --arg p "$active" '.providers[$p].model // empty' "$CONFIG" 2>/dev/null)"
key_env="$(jq -r --arg p "$active" '.providers[$p].api_key_env // "DEEPSEEK_API_KEY"' "$CONFIG" 2>/dev/null)"
timeout="$(jq -r --arg p "$active" '.providers[$p].timeout_seconds // 45' "$CONFIG" 2>/dev/null)"
max_tokens="$(jq -r --arg p "$active" '.providers[$p].max_tokens // 2048' "$CONFIG" 2>/dev/null)"
[[ -n "$base_url" && -n "$model" ]] || fail "provider '$active' missing base_url/model in $CONFIG"

# ---- resolve API key (env first; else single-key extract from root .env) ----
api_key="${!key_env:-}"
if [[ -z "$api_key" && -f "$PROJECT_ROOT/.env" ]]; then
  # Extract ONLY the one matching line; no source/eval; value never printed.
  api_key="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key_env}=" "$PROJECT_ROOT/.env" \
             | head -n1 | cut -d= -f2- \
             | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
                   -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
fi
[[ -n "$api_key" ]] || skip                 # no key → treat as opt-out, silent skip

# ---- prepare plan body -----------------------------------------------------
if [[ "$EXCLUDE_APPENDIX" == "1" ]]; then
  plan_body="$(awk '/^## Appendix: External Review/{exit} {print}' "$PLAN_FILE")"
else
  plan_body="$(cat "$PLAN_FILE")"
fi
[[ -n "$plan_body" ]] || fail "plan body is empty after preparation"

# ---- build request ---------------------------------------------------------
payload="$(jq -n \
  --arg model "$model" \
  --arg sys "$CRITIQUE_PROMPT" \
  --arg user "$plan_body" \
  --argjson max_tokens "$max_tokens" \
  '{model:$model, stream:false, max_tokens:$max_tokens,
    messages:[{role:"system",content:$sys},{role:"user",content:$user}]}')" \
  || fail "failed to build request payload"

# ---- call provider ---------------------------------------------------------
# -sS: silent but show errors; --max-time: hard timeout so /vibe-plan never hangs.
# Capture HTTP status separately so a non-200 becomes a clear advisory.
resp="$(curl -sS --max-time "$timeout" \
  -w $'\n%{http_code}' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${api_key}" \
  -X POST "${base_url}${chat_path}" \
  -d "$payload" 2>/dev/null)"
rc=$?
[[ $rc -eq 0 ]] || fail "request failed (curl exit $rc — timeout/network/DNS)"

http_code="${resp##*$'\n'}"
body="${resp%$'\n'*}"

if [[ "$http_code" != "200" ]]; then
  err="$(printf '%s' "$body" | jq -r '.error.message // empty' 2>/dev/null)"
  fail "provider returned HTTP $http_code${err:+ — $err}"
fi

content="$(printf '%s' "$body" | jq -r '.choices[0].message.content // empty' 2>/dev/null)"
[[ -n "$content" ]] || fail "could not parse provider response (no choices[0].message.content)"

printf '%s\n' "$content"
