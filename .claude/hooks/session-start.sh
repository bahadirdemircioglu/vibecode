#!/usr/bin/env bash
# Runs on SessionStart — detects project gaps and shows session state
# Output is kept SHORT (max 10 lines) to avoid noise on every session.

set -euo pipefail

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

# Install a system package using detected package manager
# Usage: pkg_install <pkg_brew> <pkg_apt> <pkg_dnf> <pkg_apk> <pkg_pacman>
pkg_install() {
  local name="$1" pkg_brew="${2:-$1}" pkg_apt="${3:-$1}" pkg_dnf="${4:-$1}" pkg_apk="${5:-$1}" pkg_pacman="${6:-$1}"
  case "$PKG_MGR" in
    brew)   brew install "$pkg_brew" --quiet 2>/dev/null && return 0 ;;
    apt)    sudo apt-get install -y -qq "$pkg_apt" 2>/dev/null && return 0 ;;
    dnf)    sudo dnf install -y -q "$pkg_dnf" 2>/dev/null && return 0 ;;
    yum)    sudo yum install -y -q "$pkg_dnf" 2>/dev/null && return 0 ;;
    apk)    sudo apk add --quiet "$pkg_apk" 2>/dev/null && return 0 ;;
    pacman) sudo pacman -S --noconfirm --quiet "$pkg_pacman" 2>/dev/null && return 0 ;;
  esac
  return 1
}

# -0. MCP dependency check — ensure Serena and Context7 can run
# Serena requires: uv/uvx (Python 3.13+), language servers per language
# Serena init: uvx -p 3.13 --from git+https://github.com/oraios/serena serena init
# Context7 requires: node/npx

if ! command -v uv &>/dev/null; then
  # uv installs the same way on all platforms via official installer
  if curl -LsSf https://astral.sh/uv/install.sh 2>/dev/null | sh 2>/dev/null; then
    # Refresh PATH to pick up uv
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    OUTPUT+="INSTALLED: uv (via official installer) — Serena dependency"$'\n'
  else
    OUTPUT+="MISSING: uv — Serena will not work. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"$'\n'
    INSTALL_NEEDED="true"
  fi
fi

if ! command -v node &>/dev/null; then
  if [[ -n "$PKG_MGR" ]]; then
    # Node.js package names differ across distros
    if pkg_install "node" "node" "nodejs" "nodejs" "nodejs" "nodejs"; then
      OUTPUT+="INSTALLED: node (via $PKG_MGR) — Context7 dependency"$'\n'
    else
      OUTPUT+="MISSING: node — Context7 will not work. Install nodejs for your platform"$'\n'
      INSTALL_NEEDED="true"
    fi
  else
    OUTPUT+="MISSING: node — no package manager found. Install: https://nodejs.org"$'\n'
    INSTALL_NEEDED="true"
  fi
fi

# npm may not come with node on some distros (e.g. Debian splits nodejs/npm)
# On macOS/Arch/Alpine, npm ships with node — if it's still missing, brew/apk/pacman will reinstall node+npm.
if command -v node &>/dev/null && ! command -v npm &>/dev/null; then
  case "$PKG_MGR" in
    apt)
      if sudo apt-get install -y -qq npm 2>/dev/null; then
        OUTPUT+="INSTALLED: npm (via apt) — required for Context7 and LSP packages"$'\n'
      else
        OUTPUT+="MISSING: npm — apt install failed. Try: sudo apt-get install npm"$'\n'
      fi
      ;;
    dnf|yum)
      if sudo "$PKG_MGR" install -y -q npm 2>/dev/null; then
        OUTPUT+="INSTALLED: npm (via $PKG_MGR)"$'\n'
      else
        OUTPUT+="MISSING: npm — $PKG_MGR install failed. Try: sudo $PKG_MGR install npm"$'\n'
      fi
      ;;
    brew)
      if brew install node --quiet 2>/dev/null; then
        OUTPUT+="INSTALLED: npm (via brew reinstall of node) — npm ships with node"$'\n'
      else
        OUTPUT+="MISSING: npm — expected to ship with node. Try: brew reinstall node"$'\n'
      fi
      ;;
    apk)
      if sudo apk add --quiet npm 2>/dev/null; then
        OUTPUT+="INSTALLED: npm (via apk)"$'\n'
      else
        OUTPUT+="MISSING: npm — apk install failed. Try: sudo apk add npm"$'\n'
      fi
      ;;
    pacman)
      if sudo pacman -S --noconfirm --quiet npm 2>/dev/null; then
        OUTPUT+="INSTALLED: npm (via pacman)"$'\n'
      else
        OUTPUT+="MISSING: npm — pacman install failed. Try: sudo pacman -S npm"$'\n'
      fi
      ;;
    *)
      OUTPUT+="MISSING: npm — no supported package manager. Install nodejs+npm: https://nodejs.org"$'\n'
      ;;
  esac
fi

# Serena project init — if uv exists but .serena/project.yml does not,
# run serena init to bootstrap the project configuration
if command -v uvx &>/dev/null && [[ ! -f "$PROJECT_ROOT/.serena/project.yml" ]]; then
  if [[ -f "$PROJECT_ROOT/.vibecode/templates/serena-project.yml" ]]; then
    mkdir -p "$PROJECT_ROOT/.serena"
    cp "$PROJECT_ROOT/.vibecode/templates/serena-project.yml" "$PROJECT_ROOT/.serena/project.yml"
    DIR_NAME=$(basename "$PROJECT_ROOT")
    sedi "s/project_name: \"vibecode\"/project_name: \"$DIR_NAME\"/" "$PROJECT_ROOT/.serena/project.yml"
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
        if command -v npm &>/dev/null && ! command -v bash-language-server &>/dev/null; then
          if ( npm install -g bash-language-server --silent >/dev/null 2>&1 ) 2>/dev/null; then
            OUTPUT+="INSTALLED: bash-language-server (via npm) — Serena bash LSP"$'\n'
          else
            OUTPUT+="MISSING: bash-language-server — npm install failed; try manually: npm install -g bash-language-server"$'\n'
          fi
        elif ! command -v npm &>/dev/null && ! command -v bash-language-server &>/dev/null; then
          OUTPUT+="MISSING: bash-language-server — npm not available for install"$'\n'
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
          if command -v go &>/dev/null; then
            go install golang.org/x/tools/gopls@latest 2>/dev/null
            OUTPUT+="INSTALLED: gopls — Serena Go LSP"$'\n'
          else
            OUTPUT+="MISSING: gopls — install Go first, then: go install golang.org/x/tools/gopls@latest"$'\n'
          fi
        fi
        ;;
      rust)
        if ! command -v rust-analyzer &>/dev/null; then
          if command -v rustup &>/dev/null; then
            rustup component add rust-analyzer 2>/dev/null
            OUTPUT+="INSTALLED: rust-analyzer (via rustup) — Serena Rust LSP"$'\n'
          else
            OUTPUT+="MISSING: rust-analyzer — install rustup first: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"$'\n'
          fi
        fi
        ;;
      cpp)
        if ! command -v clangd &>/dev/null; then
          if pkg_install "clangd" "llvm" "clang-tools-extra" "clang-extra-tools" "clang" "clang"; then
            OUTPUT+="INSTALLED: clangd (via $PKG_MGR) — Serena C/C++ LSP"$'\n'
          else
            OUTPUT+="MISSING: clangd — install clang/llvm for your platform"$'\n'
          fi
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

# 0. Auto git-init if no .git (fresh clone with deleted .git)
if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
  # Fresh clone tespit edildi — vibecode template artifact'larını temizle
  # docs/architecture/ vibecode'un kendi meta-planlarını içeriyor; yeni proje için temiz başlamalı
  if [[ -d "$PROJECT_ROOT/docs/architecture" ]]; then
    find "$PROJECT_ROOT/docs/architecture" -maxdepth 1 -name '*-plan.md' -type f -delete 2>/dev/null
    if [[ -f "$PROJECT_ROOT/.vibecode/templates/architecture-INDEX.md" ]]; then
      cp "$PROJECT_ROOT/.vibecode/templates/architecture-INDEX.md" "$PROJECT_ROOT/docs/architecture/INDEX.md"
      OUTPUT+="ARCH: docs/architecture/ template planları silindi, INDEX boş başlatıldı"$'\n'
    fi
  fi

  git -C "$PROJECT_ROOT" init -q 2>/dev/null
  git -C "$PROJECT_ROOT" add -A 2>/dev/null
  git -C "$PROJECT_ROOT" commit -q -m "Initial commit from vibecode template" 2>/dev/null
  OUTPUT+="GIT: auto-initialized and committed (fresh project)"$'\n'
fi

# 0b. Update .serena/project.yml project_name if still "vibecode"
SERENA_YML="$PROJECT_ROOT/.serena/project.yml"
if [[ -f "$SERENA_YML" ]]; then
  DIR_NAME=$(basename "$PROJECT_ROOT")
  CURRENT_NAME=$(grep -m1 'project_name:' "$SERENA_YML" | sed 's/.*: *"\(.*\)"/\1/')
  if [[ "$CURRENT_NAME" == "vibecode" && "$DIR_NAME" != "vibecode" ]]; then
    sedi "s/project_name: \"vibecode\"/project_name: \"$DIR_NAME\"/" "$SERENA_YML"
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

# 5. Stack detection — map dependencies to available skills
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
  grep -qi 'pytest' "$PY_DEPS" 2>/dev/null && add_skill "python-testing-patterns"
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
  grep -qi '"vue"' "$PKG_JSON" 2>/dev/null && add_skill "vue-expert"
  grep -qi '"angular"' "$PKG_JSON" 2>/dev/null && add_skill "angular-best-practices"
  grep -qi '"prisma"' "$PKG_JSON" 2>/dev/null && add_skill "prisma-expert"
  grep -qi '"jest"\|"vitest"' "$PKG_JSON" 2>/dev/null && add_skill "javascript-testing-patterns"
  grep -qi '"express"' "$PKG_JSON" 2>/dev/null && add_skill "nodejs-backend-patterns"
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
