#!/usr/bin/env bash

# Project Scaffold Script
# Usage: ./scripts/scaffold.sh <project-name> <target-path>
#
# Creates a new project from the vibecode template.
# This script handles the file system operations that Claude Code's
# /scaffold slash command delegates to.
#
# Example: ./scripts/scaffold.sh my-app ~/Dev/my-app

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"

# --- Args ---
if [ $# -lt 2 ]; then
  echo "Usage: ./scripts/scaffold.sh <project-name> <target-path>"
  echo ""
  echo "Example: ./scripts/scaffold.sh my-app ~/Dev/my-app"
  exit 1
fi

PROJECT_NAME="$1"
TARGET_PATH="$2"

if [ -d "$TARGET_PATH" ] && [ "$(ls -A "$TARGET_PATH" 2>/dev/null)" ]; then
  echo "❌ Target directory is not empty: $TARGET_PATH"
  exit 1
fi

echo "Scaffolding project: $PROJECT_NAME"
echo "Target: $TARGET_PATH"
echo ""

# --- Create directory structure ---
echo "Creating directories..."

mkdir -p "$TARGET_PATH"/{backend/src/{api/v1,services,models,schemas,core},backend/tests,backend/alembic}
mkdir -p "$TARGET_PATH"/{frontend/src/{components,pages,hooks,store,api,types,utils}}
mkdir -p "$TARGET_PATH"/{docs/{constraints,architecture,setup,user,admin,api}}
mkdir -p "$TARGET_PATH"/{data,scripts,backups}
mkdir -p "$TARGET_PATH"/.vibecode/{standards,skills}
mkdir -p "$TARGET_PATH"/.claude/{commands,hooks}

# --- Copy standards ---
echo "Copying standards..."
cp "$TEMPLATE_DIR"/.vibecode/standards/*.md "$TARGET_PATH/.vibecode/standards/"

# --- Copy constraint templates ---
if ls "$TEMPLATE_DIR"/docs/constraints/*.md 1>/dev/null 2>&1; then
  echo "Copying constraint templates..."
  cp "$TEMPLATE_DIR"/docs/constraints/*.md "$TARGET_PATH/docs/constraints/"
fi

# --- Copy templates ---
echo "Copying templates..."
cp "$TEMPLATE_DIR/templates/.gitignore" "$TARGET_PATH/.gitignore"
cp "$TEMPLATE_DIR/templates/.env.example" "$TARGET_PATH/.env.example"
cp "$TEMPLATE_DIR/templates/Makefile" "$TARGET_PATH/Makefile"
cp "$TEMPLATE_DIR/templates/docker-compose.yml" "$TARGET_PATH/docker-compose.yml"
cp "$TEMPLATE_DIR/templates/HANDOFF.md" "$TARGET_PATH/HANDOFF.md"

# --- Copy CLAUDE.md ---
echo "Copying CLAUDE.md..."
cp "$TEMPLATE_DIR/CLAUDE.md" "$TARGET_PATH/CLAUDE.md"

# --- Copy skills ---
echo "Copying skills..."
cp -r "$TEMPLATE_DIR/.vibecode/skills/"* "$TARGET_PATH/.vibecode/skills/" 2>/dev/null || true

# --- Copy commands ---
echo "Copying commands..."
cp "$TEMPLATE_DIR"/.claude/commands/*.md "$TARGET_PATH/.claude/commands/" 2>/dev/null || true

# --- Copy hooks ---
echo "Copying hooks..."
cp "$TEMPLATE_DIR"/.claude/hooks/*.js "$TARGET_PATH/.claude/hooks/" 2>/dev/null || true
cp "$TEMPLATE_DIR"/.claude/hooks/*.sh "$TARGET_PATH/.claude/hooks/" 2>/dev/null || true
chmod +x "$TARGET_PATH"/.claude/hooks/*.js "$TARGET_PATH"/.claude/hooks/*.sh 2>/dev/null || true

# --- Copy settings & statusline ---
if [ -f "$TEMPLATE_DIR/.claude/settings.json" ]; then
  cp "$TEMPLATE_DIR/.claude/settings.json" "$TARGET_PATH/.claude/settings.json"
fi
if [ -f "$TEMPLATE_DIR/.claude/statusline.sh" ]; then
  cp "$TEMPLATE_DIR/.claude/statusline.sh" "$TARGET_PATH/.claude/statusline.sh"
  chmod +x "$TARGET_PATH/.claude/statusline.sh"
fi

# --- Copy rules ---
if [ -d "$TEMPLATE_DIR/.claude/rules" ]; then
  echo "Copying rules..."
  mkdir -p "$TARGET_PATH/.claude/rules"
  cp "$TEMPLATE_DIR"/.claude/rules/*.md "$TARGET_PATH/.claude/rules/" 2>/dev/null || true
fi

# --- Copy scripts ---
echo "Copying scripts..."
cp "$TEMPLATE_DIR"/scripts/db-backup.sh "$TARGET_PATH/scripts/" 2>/dev/null || true
cp "$TEMPLATE_DIR"/scripts/db-restore.sh "$TARGET_PATH/scripts/" 2>/dev/null || true
chmod +x "$TARGET_PATH"/scripts/*.sh 2>/dev/null || true

# --- Create initial docs ---
echo "Creating initial docs..."

cat > "$TARGET_PATH/docs/CHANGELOG.md" << CHANGELOG
## [$(date +%Y-%m-%d)] v0.1.0 — Project scaffolded

### Changes
- **What:** Project initialized from vibecode template
- **Why:** New project setup
- **How:** Scaffolded via vibecode/scripts/scaffold.sh

### Affected Files
- All template files copied

### Notes
- Port assignment pending — run /go to configure
CHANGELOG

echo "0.1.0" > "$TARGET_PATH/docs/VERSION"

cat > "$TARGET_PATH/docs/progress.md" << PROGRESS
# Progress Tracker

<!-- Update when features/modules are added or status changes -->
PROGRESS

cat > "$TARGET_PATH/docs/decisions.md" << DECISIONS
# Architecture Decision Records

<!-- Write an ADR when: new architecture introduced, library added,
     breaking DB change, auth strategy changed -->
DECISIONS

# --- Summary ---
DIR_COUNT=$(find "$TARGET_PATH" -type d | wc -l | tr -d ' ')
FILE_COUNT=$(find "$TARGET_PATH" -type f | wc -l | tr -d ' ')

echo ""
echo "✅ Project scaffolded successfully!"
echo ""
echo "  Project: $PROJECT_NAME"
echo "  Path:    $TARGET_PATH"
echo "  Dirs:    $DIR_COUNT directories"
echo "  Files:   $FILE_COUNT files"
echo ""
echo "Next steps:"
echo "  cd $TARGET_PATH"
echo "  claude     # Open Claude Code"
echo "  /go start  # Initialize session, configure ports"
