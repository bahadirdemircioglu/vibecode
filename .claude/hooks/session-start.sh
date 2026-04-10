#!/usr/bin/env bash
# Runs on SessionStart — detects project gaps and shows session state
# Output is kept SHORT (max 10 lines) to avoid noise on every session.

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUTPUT=""
INSTALL_NEEDED=""

# -1. MCP dependency check — ensure Serena and Context7 can run
# Serena requires: uv/uvx (Python 3.13+), language servers per language
# Serena init: uvx -p 3.13 --from git+https://github.com/oraios/serena serena init
# Context7 requires: node/npx

if ! command -v uv &>/dev/null; then
  if command -v brew &>/dev/null; then
    brew install uv --quiet 2>/dev/null
    OUTPUT+="INSTALLED: uv (via Homebrew) — Serena dependency"$'\n'
  else
    OUTPUT+="MISSING: uv — Serena will not work. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"$'\n'
    INSTALL_NEEDED="true"
  fi
fi

if ! command -v node &>/dev/null; then
  if command -v brew &>/dev/null; then
    brew install node --quiet 2>/dev/null
    OUTPUT+="INSTALLED: node (via Homebrew) — Context7 dependency"$'\n'
  else
    OUTPUT+="MISSING: node — Context7 will not work. Install: brew install node"$'\n'
    INSTALL_NEEDED="true"
  fi
fi

# Serena project init — if uv exists but .serena/project.yml does not,
# run serena init to bootstrap the project configuration
if command -v uvx &>/dev/null && [[ ! -f "$PROJECT_ROOT/.serena/project.yml" ]]; then
  # Check if vibecode template exists — use it instead of serena init
  if [[ -f "$PROJECT_ROOT/.vibecode/templates/serena-project.yml" ]]; then
    mkdir -p "$PROJECT_ROOT/.serena"
    cp "$PROJECT_ROOT/.vibecode/templates/serena-project.yml" "$PROJECT_ROOT/.serena/project.yml"
    # Update project_name to match directory name
    DIR_NAME=$(basename "$PROJECT_ROOT")
    sed -i '' "s/project_name: \"vibecode\"/project_name: \"$DIR_NAME\"/" "$PROJECT_ROOT/.serena/project.yml"
    # Create .gitignore for serena cache
    printf '/cache\n/project.local.yml\n/memories\n' > "$PROJECT_ROOT/.serena/.gitignore"
    OUTPUT+="SERENA: initialized from vibecode template (project: $DIR_NAME)"$'\n'
  else
    # No template — run serena init directly
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
          npm install -g bash-language-server --silent 2>/dev/null
          OUTPUT+="INSTALLED: bash-language-server (via npm) — Serena bash LSP"$'\n'
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
          if command -v brew &>/dev/null; then
            brew install llvm --quiet 2>/dev/null
            OUTPUT+="INSTALLED: clangd (via llvm) — Serena C/C++ LSP"$'\n'
          else
            OUTPUT+="MISSING: clangd — install: brew install llvm"$'\n'
          fi
        fi
        ;;
      java)
        # jdtls is auto-managed by Serena — no manual install needed
        ;;
      csharp|csharp_omnisharp)
        if ! command -v dotnet &>/dev/null; then
          OUTPUT+="MISSING: dotnet SDK — required for C# LSP. Install: brew install dotnet"$'\n'
        fi
        ;;
    esac
  done
fi

if [[ -n "$INSTALL_NEEDED" ]]; then
  OUTPUT+="ACTION: Install missing dependencies and restart session"$'\n'
fi

# 0. Auto git-init if no .git (fresh clone with deleted .git)
if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
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
    sed -i '' "s/project_name: \"vibecode\"/project_name: \"$DIR_NAME\"/" "$SERENA_YML"
    OUTPUT+="SERENA: project_name updated to \"$DIR_NAME\""$'\n'
  fi
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
