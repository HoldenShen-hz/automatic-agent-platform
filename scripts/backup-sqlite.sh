#!/usr/bin/env bash
# =============================================================================
# SQLite Online Backup Script
# =============================================================================
# Creates a point-in-time SQLite backup using the .backup command (WAL-safe).
# Validates integrity after backup and cleans up backups older than 7 days.
#
# Usage:
#   ./backup-sqlite.sh [DB_PATH] [BACKUP_DIR]
#
# Environment variables:
#   AA_DB_PATH      SQLite database path (default: data/sqlite/authoritative-demo.db)
#   BACKUP_DIR     Backup directory (default: backups)
#   RETENTION_DAYS Number of days to retain backups (default: 7)
# =============================================================================
set -euo pipefail

DB_PATH="${AA_DB_PATH:-data/sqlite/authoritative-demo.db}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Resolve absolute path
DB_PATH="$(realpath "$DB_PATH" 2>/dev/null)" || {
  echo "ERROR: Cannot resolve DB path: $DB_PATH" >&2
  exit 1
}

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/backup_${TIMESTAMP}.db"
PID_FILE="${BACKUP_DIR}/.backup_lock"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Safety: refuse to run if a backup is already in progress
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "ERROR: Backup already in progress (PID $PID). refusing to start." >&2
    exit 1
  else
    echo "WARNING: Stale lock file found. Removing." >&2
    rm -f "$PID_FILE"
  fi
fi

# Record our PID
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT

# SQLite online backup (WAL-safe — does not require db lock)
echo "Starting backup: $DB_PATH -> $BACKUP_PATH"
sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH'" || {
  echo "ERROR: SQLite backup command failed." >&2
  rm -f "$BACKUP_PATH"
  exit 1
}

# Verify backup integrity
INTEGRITY=$(sqlite3 "$BACKUP_PATH" "PRAGMA integrity_check;" 2>&1) || {
  echo "ERROR: Could not run integrity check on backup." >&2
  rm -f "$BACKUP_PATH"
  exit 1
}

if [ "$INTEGRITY" != "ok" ]; then
  echo "ERROR: Backup integrity check failed: $INTEGRITY" >&2
  rm -f "$BACKUP_PATH"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "Backup created: $BACKUP_PATH ($BACKUP_SIZE)"

# Clean up backups older than RETENTION_DAYS
COUNT_BEFORE=$(ls "$BACKUP_DIR"/backup_*.db 2>/dev/null | wc -l | tr -d ' ')
find "$BACKUP_DIR" -name "backup_*.db" -mtime "+${RETENTION_DAYS}" -delete
COUNT_AFTER=$(ls "$BACKUP_DIR"/backup_*.db 2>/dev/null | wc -l | tr -d ' ')
DELETED=$((COUNT_BEFORE - COUNT_AFTER))
if [ "$DELETED" -gt 0 ]; then
  echo "Cleaned up $DELETED old backup(s) older than ${RETENTION_DAYS} days."
fi

echo "Done."
