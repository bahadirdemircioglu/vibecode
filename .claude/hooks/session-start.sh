#!/usr/bin/env bash
# Runs on SessionStart — detects project gaps and shows session state
# Output is kept SHORT (max 10 lines) to avoid noise on every session.

# -u + pipefail for safety, but NOT -e: this is a best-effort startup hook;
# a single failing probe must never abort the whole session-start output.
set -uo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUTPUT=""
INSTALL_NEEDED=""

# Read hook input from stdin once (used for model detection below).
# Stdin contains JSON from Claude Code hook protocol; may be empty on manual runs.
HOOK_INPUT=""
if [[ ! -t 0 ]]; then
  HOOK_INPUT="$(cat 2>/dev/null || echo '')"
fi

# -1. OS & package manager detection
# Supports: macOS (brew), Debian/Ubuntu (apt), Fedora/RHEL (dnf/yum), Alpine (apk), Arch (pacman)
HOST_OS="$(uname -s)"
PKG_MGR=""
if command -v brew &>/dev/null; then
  PKG_MGR="brew"
elif command -v apt-get &>/dev/null; then
  PKG_MGR="apt"
elif command -v dnf &>/dev/null; then
  PKG_MGR="dnf"
elif command -v yum &>/dev/null; then
  PKG_MGR="yum"
elif command -v apk &>/dev/null; then
  PKG_MGR="apk"
elif command -v pacman &>/dev/null; then
  PKG_MGR="pacman"
fi

# Portable sed -i (macOS uses sed -i '', Linux uses sed -i)
sedi() {
  if [[ "$HOST_OS" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# Build a platform-specific install hint for a system package.
# Usage: pkg_hint <pkg_brew> <pkg_apt> <pkg_dnf> <pkg_apk> <pkg_pacman>
# NOTE: this hook NEVER installs anything on the host (Docker-first rule; no
# curl|sh, no sudo, no npm -g). It only prints a MISSING line with the command
# the user can run themselves.
pkg_hint() {
  local pkg_brew="$1" pkg_apt="${2:-$1}" pkg_dnf="${3:-$1}" pkg_apk="${4:-$1}" pkg_pacman="${5:-$1}"
  case "$PKG_MGR" in
    brew)    echo "brew install $pkg_brew" ;;
    apt)     echo "sudo apt-get install $pkg_apt" ;;
    dnf|yum) echo "sudo $PKG_MGR install $pkg_dnf" ;;
    apk)     echo "sudo apk add $pkg_apk" ;;
    pacman)  echo "sudo pacman -S $pkg_pacman" ;;
    *)       echo "install $pkg_apt with your OS package manager" ;;
  esac
}

# -0. MCP dependency check — report (never install) what Serena / Context7 need
# Serena requires: uv/uvx (Python 3.13+), language servers per language
# Context7 requires: node/npx

if ! command -v uv &>/dev/null; then
  OUTPUT+="MISSING: uv — Serena will not work. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"$'\n'
  INSTALL_NEEDED="true"
fi

if ! command -v node &>/dev/null; then
  OUTPUT+="MISSING: node — Context7 will not work. Install: $(pkg_hint node nodejs nodejs nodejs nodejs) (or https://nodejs.org)"$'\n'
  INSTALL_NEEDED="true"
elif ! command -v npm &>/dev/null; then
  # npm may not ship with node on some distros (e.g. Debian splits nodejs/npm)
  OUTPUT+="MISSING: npm — required for Context7/npx. Install: $(pkg_hint node npm npm npm npm)"$'\n'
  INSTALL_NEEDED="true"
fi

# Serena project init — if uv exists but .serena/project.yml does not,
# run serena init to bootstrap the project configuration
if command -v uvx &>/dev/null && [[ ! -f "$PROJECT_ROOT/.serena/project.yml" ]]; then
  if [[ -f "$PROJECT_ROOT/.vibecode/templates/serena-project.yml" ]]; then
    mkdir -p "$PROJECT_ROOT/.serena"
    cp "$PROJECT_ROOT/.vibecode/templates/serena-project.yml" "$PROJECT_ROOT/.serena/project.yml"
    DIR_NAME=$(basename "$PROJECT_ROOT")
    DIR_NAME_SED=$(printf '%s' "$DIR_NAME" | sed 's/[&|\\]/\\&/g')
    sedi "s|{{PROJECT_NAME}}|$DIR_NAME_SED|" "$PROJECT_ROOT/.serena/project.yml"
    printf '/cache\n/project.local.yml\n/memories\n' > "$PROJECT_ROOT/.serena/.gitignore"
    OUTPUT+="SERENA: initialized from vibecode template (project: $DIR_NAME)"$'\n'
  else
    uvx -p 3.13 --from "git+https://github.com/oraios/serena" serena init --project-root "$PROJECT_ROOT" 2>/dev/null
    OUTPUT+="SERENA: initialized via 'serena init' — check .serena/project.yml"$'\n'
  fi
  OUTPUT+="ACTION: Restart session for Serena to pick up new project config"$'\n'
  INSTALL_NEEDED="true"
fi

# Check language servers based on .serena/project.yml languages
SERENA_YML_CHECK="$PROJECT_ROOT/.serena/project.yml"
if [[ -f "$SERENA_YML_CHECK" ]]; then
  LANGS=$(grep -A 20 '^languages:' "$SERENA_YML_CHECK" | grep '^- ' | sed 's/^- //' | tr -d ' ')

  for LANG in $LANGS; do
    case "$LANG" in
      bash)
        if ! command -v bash-language-server &>/dev/null; then
          OUTPUT+="MISSING: bash-language-server — Serena bash LSP. Install: npm install -g bash-language-server"$'\n'
        fi
        ;;
      python|python_jedi)
        # Python LSPs are auto-managed by Serena via uv — no manual install needed
        ;;
      typescript|typescript_vts)
        # TypeScript LSPs are auto-managed by Serena — no manual install needed
        ;;
      go)
        if ! command -v gopls &>/dev/null; then
          OUTPUT+="MISSING: gopls — Serena Go LSP. Install (needs Go): go install golang.org/x/tools/gopls@latest"$'\n'
        fi
        ;;
      rust)
        if ! command -v rust-analyzer &>/dev/null; then
          OUTPUT+="MISSING: rust-analyzer — Serena Rust LSP. Install (needs rustup): rustup component add rust-analyzer"$'\n'
        fi
        ;;
      cpp)
        if ! command -v clangd &>/dev/null; then
          OUTPUT+="MISSING: clangd — Serena C/C++ LSP. Install: $(pkg_hint llvm clangd clang-tools-extra clang-extra-tools clang)"$'\n'
        fi
        ;;
      java)
        # jdtls is auto-managed by Serena — no manual install needed
        ;;
      csharp|csharp_omnisharp)
        if ! command -v dotnet &>/dev/null; then
          OUTPUT+="MISSING: dotnet SDK — required for C# LSP. See: https://dotnet.microsoft.com/download"$'\n'
        fi
        ;;
    esac
  done
fi

# Validate .mcp.json — fix wrong Serena command ("mcp" → "start-mcp-server")
MCP_JSON="$PROJECT_ROOT/.mcp.json"
if [[ -f "$MCP_JSON" ]]; then
  if grep -q '"serena"' "$MCP_JSON" && grep -q '"mcp"' "$MCP_JSON" && ! grep -q '"start-mcp-server"' "$MCP_JSON"; then
    sedi 's/"mcp"/"start-mcp-server"/g' "$MCP_JSON"
    OUTPUT+="FIXED: .mcp.json Serena command corrected (mcp → start-mcp-server)"$'\n'
  fi
fi

if [[ -n "$INSTALL_NEEDED" ]]; then
  OUTPUT+="ACTION: Install missing dependencies and restart session"$'\n'
fi

# 0. Fresh-clone bootstrap (clone vibecode → rm -rf .git → first session).
# Guarded by an explicit marker so it can NEVER fire in an arbitrary non-git
# directory the framework was layered into. Conditions (all required) are
# documented in .vibecode/templates/fresh-clone.marker:
#   no .git + not inside a work tree + no .vibecode/VERSION + every identity
#   path listed in the marker exists (vibecode's own meta-plans).
is_fresh_clone() {
  local marker="$PROJECT_ROOT/.vibecode/templates/fresh-clone.marker" line found=0
  [[ -e "$PROJECT_ROOT/.git" ]] && return 1
  git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree &>/dev/null && return 1
  [[ -f "$PROJECT_ROOT/.vibecode/VERSION" ]] && return 1
  [[ -f "$marker" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"; line="${line//[[:space:]]/}"
    [[ -z "$line" ]] && continue
    [[ "$line" == /* || "$line" == *..* ]] && return 1   # relative, in-tree paths only
    [[ -e "$PROJECT_ROOT/$line" ]] || return 1
    found=1
  done < "$marker"
  [[ "$found" -eq 1 ]]
}

if is_fresh_clone; then
  TPL="$PROJECT_ROOT/.vibecode/templates"
  # docs/architecture/ holds vibecode's own meta-plans — a new project starts clean.
  find "$PROJECT_ROOT/docs/architecture" -maxdepth 1 -name '*-plan.md' -type f -delete 2>/dev/null
  find "$PROJECT_ROOT/docs/architecture/debates" -type f \( -name '*.json' -o -name '*.md' \) -delete 2>/dev/null
  [[ -f "$TPL/architecture-INDEX.md" ]] && cp "$TPL/architecture-INDEX.md" "$PROJECT_ROOT/docs/architecture/INDEX.md"
  # Framework-history docs → reset from minimal templates (don't inherit vibecode's history).
  for pair in "docs-decisions.md:docs/decisions.md" \
              "docs-CHANGELOG.md:docs/CHANGELOG.md" \
              "docs-progress.md:docs/progress.md" \
              "docs-CHANGELOG_INTERNAL.md:docs/CHANGELOG_INTERNAL.md"; do
    src="$TPL/${pair%%:*}"; dst="$PROJECT_ROOT/${pair#*:}"
    [[ -f "$src" ]] && mkdir -p "$(dirname "$dst")" && cp "$src" "$dst"
  done
  # Pure vibecode artifacts with no project equivalent.
  rm -f "$PROJECT_ROOT/docs/vibecode-analiz-raporu.md" "$PROJECT_ROOT/HANDOFF.md"
  find "$PROJECT_ROOT/.vibecode/memory" "$PROJECT_ROOT/.serena/memories" -type f -delete 2>/dev/null   # vibecode's own memories
  OUTPUT+="FRESH-CLONE: vibecode history docs reset from templates (architecture plans, decisions, CHANGELOG, progress, HANDOFF, memories)"$'\n'

  if git -C "$PROJECT_ROOT" init -q 2>/dev/null; then
    # Record the vibecode framework baseline so /vibe-update can later detect which
    # framework files the user has customized (hash-based 3-way merge). Written
    # BEFORE the initial commit so .vibecode/VERSION ships in it.
    if [[ -x "$PROJECT_ROOT/.vibecode/scripts/vibe-update" ]]; then
      if bash "$PROJECT_ROOT/.vibecode/scripts/vibe-update" init >/dev/null 2>&1; then
        OUTPUT+="VIBE-UPDATE: framework baseline recorded (.vibecode/VERSION)"$'\n'
      fi
    fi
    # Stage an EXPLICIT framework path list — never `git add -A` (would sweep
    # in whatever else happens to be in the directory).
    STAGE=()
    for p in .claude .vibecode docs CLAUDE.md .gitignore .mcp.json README.md; do
      [[ -e "$PROJECT_ROOT/$p" ]] && STAGE+=("$p")
    done
    if [[ ${#STAGE[@]} -gt 0 ]] \
       && git -C "$PROJECT_ROOT" add -- "${STAGE[@]}" 2>/dev/null \
       && git -C "$PROJECT_ROOT" commit -q -m "Initial commit from vibecode template" 2>/dev/null; then
      OUTPUT+="GIT: initialized + initial commit (${STAGE[*]})"$'\n'
    else
      OUTPUT+="GIT: initialized; initial commit NOT created (check git user.name/email, then commit manually)"$'\n'
    fi
  else
    OUTPUT+="GIT: git init failed — initialize the repository manually"$'\n'
  fi
fi

# 0b. Update .serena/project.yml project_name if still "vibecode"
SERENA_YML="$PROJECT_ROOT/.serena/project.yml"
if [[ -f "$SERENA_YML" ]]; then
  DIR_NAME=$(basename "$PROJECT_ROOT")
  CURRENT_NAME=$(grep -m1 'project_name:' "$SERENA_YML" | sed 's/.*: *"\(.*\)"/\1/')
  if [[ ( "$CURRENT_NAME" == "vibecode" || "$CURRENT_NAME" == "{{PROJECT_NAME}}" ) && "$DIR_NAME" != "vibecode" ]]; then
    DIR_NAME_SED=$(printf '%s' "$DIR_NAME" | sed 's/[&|\\]/\\&/g')
    sedi "s|project_name: \"$CURRENT_NAME\"|project_name: \"$DIR_NAME_SED\"|" "$SERENA_YML"
    OUTPUT+="SERENA: project_name updated to \"$DIR_NAME\""$'\n'
  fi
fi

# 0c. Serena onboarding is handled by Serena itself — not by this hook.
# The hook only creates .serena/project.yml (config). Serena's own onboarding
# tool creates memories when Claude calls it in the first session.

# 0d. Model check — Sonnet-first politikası
# Opus tespit edilirse kullanıcıya Sonnet'e geçmeyi öner (auto-switch YOK).
MODEL=""

# Birincil: hook input JSON'dan
if [[ -n "$HOOK_INPUT" ]]; then
  if command -v jq &>/dev/null; then
    MODEL="$(echo "$HOOK_INPUT" | jq -r '.model // empty' 2>/dev/null)"
  fi
  # jq yoksa ya da boş döndüyse regex fallback
  if [[ -z "$MODEL" ]]; then
    MODEL="$(echo "$HOOK_INPUT" | grep -o '"model"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
  fi
fi

# Yedek: en güncel session JSONL'den son assistant mesajının modeli
if [[ -z "$MODEL" ]]; then
  ENCODED_PROJECT="$(echo "$PROJECT_ROOT" | sed 's|/|-|g')"
  SESSION_DIR="$HOME/.claude/projects$ENCODED_PROJECT"
  if [[ -d "$SESSION_DIR" ]]; then
    LATEST_SESSION="$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)"
    if [[ -f "$LATEST_SESSION" ]] && command -v jq &>/dev/null; then
      # Son 50 satırı tersten tara, ilk model alanını yakala
      MODEL="$(awk '{a[NR]=$0} END{for(i=NR;i>NR-50 && i>0;i--) print a[i]}' "$LATEST_SESSION" 2>/dev/null \
        | jq -r 'select(.message.model) | .message.model' 2>/dev/null | head -1)"
    fi
  fi
fi

# Family check (substring match — yeni model release'lerine resilience)
if [[ -n "$MODEL" ]]; then
  case "$MODEL" in
    *opus*)
      OUTPUT+="MODEL: Opus tespit edildi (${MODEL}). Sonnet'e geçmek için: /model sonnet"$'\n'
      OUTPUT+="       Bilinçli olarak Opus istediyseniz (planlama/derin debug) görmezden gelin."$'\n'
      ;;
    *haiku*)
      OUTPUT+="MODEL: Haiku tespit edildi. Hızlı yanıt için OK; karmaşık iş için: /model sonnet"$'\n'
      ;;
    *sonnet*)
      : # hedef model, sessiz geç
      ;;
  esac
fi

# 0e. Repo-local memory — Claude's auto memory lives IN the repo (.vibecode/memory/, committed),
# so it survives a server rebuild + `git clone`. autoMemoryDirectory must be an absolute path,
# so it goes into the per-machine, gitignored .claude/settings.local.json (never the committed
# settings.json). Claude Code reads settings at startup → a change applies from the NEXT
# session; CLAUDE.md @imports .vibecode/memory/MEMORY.md so the first session still sees it.
MEM_DIR="$PROJECT_ROOT/.vibecode/memory"
if [[ -d "$PROJECT_ROOT/.vibecode" ]]; then
  mkdir -p "$MEM_DIR"
  [[ -f "$MEM_DIR/MEMORY.md" ]] || printf '%s\n' '<!-- Project memory index (Claude auto memory, committed with the repo). One line per memory: - [Title](file.md) — hook -->' > "$MEM_DIR/MEMORY.md"
  if command -v node &>/dev/null; then
    MEM_SET=$(MEM_DIR="$MEM_DIR" LOCAL="$PROJECT_ROOT/.claude/settings.local.json" node -e '
      const fs = require("fs"); const f = process.env.LOCAL; let s = {};
      try { s = JSON.parse(fs.readFileSync(f, "utf-8")); } catch (e) { if (fs.existsSync(f)) { console.log("invalid"); process.exit(0); } }
      if (s.autoMemoryDirectory === process.env.MEM_DIR) process.exit(0);
      s.autoMemoryDirectory = process.env.MEM_DIR;
      fs.mkdirSync(require("path").dirname(f), { recursive: true });
      fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");
      console.log("set");' 2>/dev/null)
    case "$MEM_SET" in
      set) OUTPUT+="MEMORY: auto memory → .vibecode/memory (repo, committed) — active from next session"$'\n' ;;
      invalid) OUTPUT+="MEMORY: .claude/settings.local.json is not valid JSON — autoMemoryDirectory not set"$'\n' ;;
    esac
  fi
fi

# 1. Check HANDOFF.md
if [[ -f "$PROJECT_ROOT/HANDOFF.md" ]]; then
  # Markers follow .vibecode/templates/HANDOFF.md ("- **Status:** …" under
  # "## Current State", first "- [ ] …" under "## Next Steps").
  STATUS=$(grep -m1 -E '^[-*] \*\*Status:\*\*' "$PROJECT_ROOT/HANDOFF.md" 2>/dev/null | sed -E 's/.*\*\*Status:\*\*[[:space:]]*//')
  NEXT=$(grep -m1 -E '^[[:space:]]*[-*] \[ \]' "$PROJECT_ROOT/HANDOFF.md" 2>/dev/null | sed -E 's/^[[:space:]]*[-*] \[ \][[:space:]]*//')
  STATUS="${STATUS:-unknown}"; NEXT="${NEXT:-none listed}"
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

# 5. Stack detection — map dependencies to available skills.
# NOTE: not every referenced skill ships in .vibecode/skills/. Extended-stack
# skills (django-pro, nextjs-best-practices, golang-pro, rust-pro, terraform-
# specialist, etc.) resolve from the user-level catalog ($HOME/.claude/skills)
# when present. skill_exists() checks BOTH dirs and add_skill silently skips
# any skill found in neither — detection degrades gracefully, never errors.
SKILLS=""
SKILL_DIRS=("$PROJECT_ROOT/.vibecode/skills" "$HOME/.claude/skills")

skill_exists() {
  for dir in "${SKILL_DIRS[@]}"; do
    [[ -d "$dir/$1" ]] && return 0
  done
  return 1
}

add_skill() {
  for s in "$@"; do
    [[ ", $SKILLS, " == *", $s, "* ]] && continue   # dedupe
    if skill_exists "$s"; then
      [[ -n "$SKILLS" ]] && SKILLS+=", "
      SKILLS+="$s"
    fi
  done
}

# Python (pyproject.toml or requirements.txt)
PY_DEPS=""
[[ -f "$PROJECT_ROOT/backend/pyproject.toml" ]] && PY_DEPS="$PROJECT_ROOT/backend/pyproject.toml"
[[ -z "$PY_DEPS" && -f "$PROJECT_ROOT/pyproject.toml" ]] && PY_DEPS="$PROJECT_ROOT/pyproject.toml"
[[ -z "$PY_DEPS" && -f "$PROJECT_ROOT/requirements.txt" ]] && PY_DEPS="$PROJECT_ROOT/requirements.txt"

if [[ -n "$PY_DEPS" ]]; then
  add_skill "python-pro"
  grep -qi 'fastapi' "$PY_DEPS" 2>/dev/null && add_skill "fastapi-pro" "fastapi-router-py"
  grep -qi 'sqlalchemy' "$PY_DEPS" 2>/dev/null && add_skill "postgresql" "sql-optimization-patterns"
  grep -qi 'pydantic' "$PY_DEPS" 2>/dev/null && add_skill "pydantic-models-py"
  grep -qi 'alembic' "$PY_DEPS" 2>/dev/null && add_skill "database-migrations-sql-migrations"
  grep -qi 'celery' "$PY_DEPS" 2>/dev/null && add_skill "async-python-patterns"
  grep -qi 'pytest' "$PY_DEPS" 2>/dev/null && add_skill "python-testing-patterns" "tdd-workflows-tdd-cycle"
  grep -qi 'django' "$PY_DEPS" 2>/dev/null && add_skill "django-pro"
  grep -qi 'flask' "$PY_DEPS" 2>/dev/null && add_skill "python-pro"
fi

# JavaScript/TypeScript (package.json)
PKG_JSON=""
[[ -f "$PROJECT_ROOT/frontend/package.json" ]] && PKG_JSON="$PROJECT_ROOT/frontend/package.json"
[[ -z "$PKG_JSON" && -f "$PROJECT_ROOT/package.json" ]] && PKG_JSON="$PROJECT_ROOT/package.json"

if [[ -n "$PKG_JSON" ]]; then
  add_skill "typescript-pro"
  grep -qi '"react"' "$PKG_JSON" 2>/dev/null && add_skill "react-patterns" "react-best-practices"
  grep -qi '"next"' "$PKG_JSON" 2>/dev/null && add_skill "nextjs-best-practices"
  grep -qi '"zustand"' "$PKG_JSON" 2>/dev/null && add_skill "zustand-store-ts"
  grep -qi 'tanstack' "$PKG_JSON" 2>/dev/null && add_skill "react-state-management"
  grep -qi '"tailwindcss"' "$PKG_JSON" 2>/dev/null && add_skill "tailwind-patterns"
  grep -qi '"angular"' "$PKG_JSON" 2>/dev/null && add_skill "angular-best-practices"
  grep -qi '"prisma"' "$PKG_JSON" 2>/dev/null && add_skill "prisma-expert"
  grep -qi '"jest"\|"vitest"' "$PKG_JSON" 2>/dev/null && add_skill "javascript-testing-patterns" "tdd-workflows-tdd-cycle"
  grep -qi '"nestjs"\|"@nestjs"' "$PKG_JSON" 2>/dev/null && add_skill "nestjs-expert"
fi

# Docker
[[ -f "$PROJECT_ROOT/docker-compose.yml" || -f "$PROJECT_ROOT/docker-compose.yaml" ]] && add_skill "docker-expert"
[[ -f "$PROJECT_ROOT/Dockerfile" || -f "$PROJECT_ROOT/backend/Dockerfile" ]] && add_skill "docker-expert"

# Terraform
[[ -f "$PROJECT_ROOT/main.tf" || -d "$PROJECT_ROOT/terraform" ]] && add_skill "terraform-specialist"

# Go
[[ -f "$PROJECT_ROOT/go.mod" ]] && add_skill "golang-pro" "go-concurrency-patterns"

# Rust
[[ -f "$PROJECT_ROOT/Cargo.toml" ]] && add_skill "rust-pro"

# Ruby
[[ -f "$PROJECT_ROOT/Gemfile" ]] && add_skill "ruby-pro"

if [[ -n "$SKILLS" ]]; then
  OUTPUT+="SKILLS: ${SKILLS}"$'\n'
fi

# Print output (only if there is something to report)
if [[ -n "$OUTPUT" ]]; then
  echo "--- Session Start Check ---"
  echo -n "$OUTPUT"
  echo "---"
fi
