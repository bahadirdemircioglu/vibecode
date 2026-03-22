#!/usr/bin/env bash

# Database Restore Script
# Usage: ./scripts/db-restore.sh [backup_file]
#
# Restores a database from a backup dump file.
# If no file is specified, lists available backups.
#
# Referenced by: docs/standards/backup.md

set -euo pipefail

BACKUP_DIR="./backups"

# Load env vars
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

DB_USER="${POSTGRES_USER:-myproject_user}"
DB_NAME="${POSTGRES_DB:-myproject}"

# If no argument, list available backups
if [ $# -eq 0 ]; then
  echo "Available backups:"
  echo "---"
  if ls -1 "$BACKUP_DIR"/*.dump 1>/dev/null 2>&1; then
    ls -1t "$BACKUP_DIR"/*.dump | while read -r f; do
      SIZE=$(du -h "$f" | cut -f1)
      echo "  $f ($SIZE)"
    done
  else
    echo "  No backups found in $BACKUP_DIR/"
  fi
  echo ""
  echo "Usage: ./scripts/db-restore.sh <backup_file>"
  exit 0
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  This will DROP and RECREATE the database '$DB_NAME'."
echo "    Restoring from: $BACKUP_FILE"
read -p "    Continue? (y/N) " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo "Restoring database..."

docker compose exec -T postgres pg_restore \
  -U "$DB_USER" \
  --clean \
  --if-exists \
  -d "$DB_NAME" < "$BACKUP_FILE"

echo "✅ Database restored from: $BACKUP_FILE"
