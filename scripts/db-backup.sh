#!/usr/bin/env bash

# Database Backup Script
# Usage: ./scripts/db-backup.sh
#
# Creates a timestamped SQL dump of the development database.
# Backups are stored in ./backups/ (gitignored).
#
# Referenced by: .vibecode/standards/backup.md

set -euo pipefail

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load env vars
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

DB_USER="${POSTGRES_USER:-myproject_user}"
DB_NAME="${POSTGRES_DB:-myproject}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup of database '$DB_NAME'..."

docker compose exec -T postgres pg_dump \
  -U "$DB_USER" \
  --format=custom \
  --compress=9 \
  "$DB_NAME" > "${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

echo "✅ Backup saved: ${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

# Keep only last 10 backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.dump 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  echo "Cleaning old backups (keeping last 10)..."
  ls -1t "$BACKUP_DIR"/*.dump | tail -n +11 | xargs rm -f
fi

echo "Done. Total backups: $(ls -1 "$BACKUP_DIR"/*.dump 2>/dev/null | wc -l)"
