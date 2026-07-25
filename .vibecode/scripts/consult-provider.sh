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
#   (default DEEPSEEK_API_KEY), or — if unset — from a dedicated framework secrets
#   file (see resolution order below). The project's OWN .env is deliberately NOT
#   read: vibecode is usually layered inside another project whose root .env belongs
#   to THAT app; mixing a framework provider key into it (and risking it being
#   committed with the app) would be wrong. Framework secrets live on their own.
#   When a file is used, ONLY the matching key line is extracted — no `source`/
#   `eval`, so the file is never executed. The key travels solely in the curl
#   Authorization header and is NEVER written to stdout/stderr, so it never reaches
#   the model (preserving the intent of the settings.json .env deny-list).
#
#   Key resolution order (first match wins):
#     1. $<api_key_env> already in the environment (e.g. exported in your shell rc)
#     2. $VIBECODE_ENV_FILE                         (explicit path override)
#     3. .vibecode/providers.env                    (project-local, gitignored)
#     4. ${XDG_CONFIG_HOME:-~/.config}/vibecode/providers.env
#                                                   (machine-global — recommended)
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

# ---- resolve API key -------------------------------------------------------
# Reads ONLY the matching key line from a file; no source/eval; value never printed.
# NOTE: the project's own .env is intentionally never consulted (see header).
read_key_from() { # <file> → prints value (empty if file absent / key not found)
  local f="$1"
  [[ -n "$f" && -f "$f" ]] || return 0
  grep -E "^[[:space:]]*(export[[:space:]]+)?${key_env}=" "$f" \
    | head -n1 | cut -d= -f2- \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
          -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}
api_key="${!key_env:-}"
[[ -n "$api_key" ]] || api_key="$(read_key_from "${VIBECODE_ENV_FILE:-}")"
[[ -n "$api_key" ]] || api_key="$(read_key_from "$PROJECT_ROOT/.vibecode/providers.env")"
[[ -n "$api_key" ]] || api_key="$(read_key_from "${XDG_CONFIG_HOME:-$HOME/.config}/vibecode/providers.env")"
[[ -n "$api_key" ]] || skip                 # no key anywhere → opt-out, silent skip

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

# CONSULT_DEBUG=1 dumps the raw response (status + body) to stderr for diagnosis.
# The body is the provider's reply (critique / error JSON) — it carries no API key.
if [[ "${CONSULT_DEBUG:-}" == "1" ]]; then
  echo "consult[debug] http_code=$http_code" >&2
  echo "consult[debug] raw body >>>" >&2
  printf '%s\n' "$body" >&2
  echo "consult[debug] <<< end body" >&2
fi

# Some providers return an error object even with HTTP 200 — check it first.
err="$(printf '%s' "$body" | jq -r '.error.message // empty' 2>/dev/null)"
[[ -z "$err" ]] || fail "provider error: $err"

[[ "$http_code" == "200" ]] || fail "provider returned HTTP $http_code"

jqr() { printf '%s' "$body" | jq -r "$1 // empty" 2>/dev/null; }
content="$(jqr '.choices[0].message.content')"   # may be "" (empty string)
finish="$(jqr '.choices[0].finish_reason')"
# Legacy/alt answer field, just in case a provider uses it.
[[ -n "$content" ]] || content="$(jqr '.choices[0].text')"

if [[ -z "$content" ]]; then
  # Reasoning models (DeepSeek v4-*) put chain-of-thought in `reasoning_content`
  # and the ANSWER in `content`. If max_tokens is exhausted by reasoning, `content`
  # comes back "" with finish_reason=length — the #1 cause of a "no content" reply.
  if [[ "$finish" == "length" ]]; then
    fail "response truncated before the answer (finish_reason=length). Raise max_tokens in .vibecode/config/ai-providers.json — reasoning models (deepseek-v4-*) burn tokens on reasoning first; try 8192+."
  fi
  # Finished but only reasoning present → surface that rather than nothing.
  reasoning="$(jqr '.choices[0].message.reasoning_content')"
  if [[ -n "$reasoning" ]]; then
    printf '%s\n' "$reasoning"; exit 0
  fi
  # Non-secret snippet so the caller can see WHAT came back (proxy HTML, empty
  # choices, unexpected shape, …). The body carries no API key.
  snippet="$(printf '%s' "$body" | tr '\n\r\t' '   ' | cut -c1-300)"
  fail "empty/unparseable provider response (HTTP $http_code). body[0:300]: ${snippet:-<empty>}"
fi

printf '%s\n' "$content"
