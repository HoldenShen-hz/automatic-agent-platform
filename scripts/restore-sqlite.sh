#!/usr/bin/env bash
# =============================================================================
# SQLite Restore Script
# =============================================================================
# Restores SQLite database from a backup file created by backup-sqlite.sh.
# Creates a pre-restore snapshot of the current DB before restoring.
#
# Usage:
#   ./restore-sqlite.sh BACKUP_PATH [DB_PATH]
#
# Environment variables:
#   AA_DB_PATH   Target database path (default: data/sqlite/authoritative-demo.db)
#
# Arguments:
#   BACKUP_PATH  Path to the .db backup file to restore from (required)
#   DB_PATH      Target database path (default: from AA_DB_PATH or env default)
# =============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 BACKUP_PATH [DB_PATH]" >&2
  echo "ERROR: Missing required argument BACKUP_PATH" >&2
  exit 1
fi

BACKUP_PATH="$1"
DB_PATH="${2:-${AA_DB_PATH:-data/sqlite/authoritative-demo.db}}"

# Resolve absolute paths
BACKUP_PATH="$(realpath "$BACKUP_PATH" 2>/dev/null)" || {
  echo "ERROR: Cannot resolve backup path: $BACKUP_PATH" >&2
  exit 1
}
DB_PATH="$(realpath "$DB_PATH" 2>/dev/null)" || {
  echo "ERROR: Cannot resolve DB path: $DB_PATH" >&2
  exit 1
}

# Verify backup file exists
if [ ! -f "$BACKUP_PATH" ]; then
  echo "ERROR: Backup file not found: $BACKUP_PATH" >&2
  exit 1
fi

# Verify backup integrity before restoring
echo "Verifying backup integrity: $BACKUP_PATH"
INTEGRITY=$(sqlite3 "$BACKUP_PATH" "PRAGMA integrity_check;" 2>&1) || {
  echo "ERROR: Could not run integrity check on backup." >&2
  exit 1
}

if [ "$INTEGRITY" != "ok" ]; then
  echo "ERROR: Backup integrity check failed: $INTEGRITY" >&2
  exit 1
fi
echo "Backup integrity: OK"

# Create pre-restore safety copy
PRE_RESTORE="${DB_PATH}.pre-restore.$(date +%s)"
if [ -f "$DB_PATH" ]; then
  echo "Creating pre-restore snapshot: $PRE_RESTORE"
  cp "$DB_PATH" "$PRE_RESTORE"
else
  echo "WARNING: Current DB does not exist at $DB_PATH — no pre-restore snapshot created."
fi

# Restore
echo "Restoring: $BACKUP_PATH -> $DB_PATH"
cp "$BACKUP_PATH" "$DB_PATH" || {
  echo "ERROR: Failed to copy backup to target DB path." >&2
  echo "Pre-restore snapshot available at: $PRE_RESTORE" >&2
  exit 1
}

# Verify restored DB opens correctly
echo "Verifying restored database..."
TABLES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1) || {
  echo "ERROR: Restored database is not readable: $TABLES" >&2
  echo "Pre-restore snapshot available at: $PRE_RESTORE" >&2
  exit 1
}

echo "Restored successfully: $DB_PATH"
echo "Pre-restore snapshot: $PRE_RESTORE"
echo "Done."
