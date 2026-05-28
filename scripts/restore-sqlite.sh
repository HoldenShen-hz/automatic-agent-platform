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
#   AA_DB_PATH   Target database path (default: data/sqlite/automatic-agent.db)
#   AA_BACKUP_ENCRYPTION_KEY_FILE  Required when restoring a .enc backup
#
# Arguments:
#   BACKUP_PATH  Path to the .db backup file to restore from (required)
#   DB_PATH      Target database path (default: from AA_DB_PATH or env default)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATION_PLAN_PATH="${REPO_ROOT}/src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.ts"
CIPHER="aes-256-cbc"

if [ $# -lt 1 ]; then
  echo "Usage: $0 BACKUP_PATH [DB_PATH]" >&2
  echo "ERROR: Missing required argument BACKUP_PATH" >&2
  exit 1
fi

BACKUP_PATH="$1"
DB_PATH="${2:-${AA_DB_PATH:-data/sqlite/automatic-agent.db}}"
DECRYPTED_BACKUP_PATH=""
TMP_RESTORE_PATH=""

# Resolve absolute paths
BACKUP_PATH="$(realpath "$BACKUP_PATH" 2>/dev/null)" || {
  echo "ERROR: Cannot resolve backup path: $BACKUP_PATH" >&2
  exit 1
}
DB_PATH="$(realpath "$DB_PATH" 2>/dev/null)" || {
  mkdir -p "$(dirname "$DB_PATH")"
  DB_PATH="$(cd "$(dirname "$DB_PATH")" && pwd)/$(basename "$DB_PATH")"
}

# Verify backup file exists
if [ ! -f "$BACKUP_PATH" ]; then
  echo "ERROR: Backup file not found: $BACKUP_PATH" >&2
  exit 1
fi

if [[ "$BACKUP_PATH" == *.enc ]]; then
  if [ -z "${AA_BACKUP_ENCRYPTION_KEY_FILE:-}" ] || [ ! -f "$AA_BACKUP_ENCRYPTION_KEY_FILE" ]; then
    echo "ERROR: AA_BACKUP_ENCRYPTION_KEY_FILE is required to restore encrypted backups." >&2
    exit 1
  fi
  DECRYPTED_BACKUP_PATH="$(mktemp "${TMPDIR:-/tmp}/aa-restore.XXXXXX.db")"
  openssl enc -d -"${CIPHER}" -pbkdf2 -iter 200000 -md sha256 \
    -pass "file:${AA_BACKUP_ENCRYPTION_KEY_FILE}" \
    -in "$BACKUP_PATH" \
    -out "$DECRYPTED_BACKUP_PATH"
  BACKUP_PATH="$DECRYPTED_BACKUP_PATH"
fi

trap 'rm -f "$DECRYPTED_BACKUP_PATH" "$TMP_RESTORE_PATH"' EXIT

if [ -f "${BACKUP_PATH}.sha256" ]; then
  echo "Verifying backup checksum: ${BACKUP_PATH}.sha256"
  if command -v shasum >/dev/null 2>&1; then
    (cd "$(dirname "$BACKUP_PATH")" && shasum -a 256 -c "$(basename "${BACKUP_PATH}.sha256")")
  elif command -v sha256sum >/dev/null 2>&1; then
    (cd "$(dirname "$BACKUP_PATH")" && sha256sum -c "$(basename "${BACKUP_PATH}.sha256")")
  else
    echo "ERROR: checksum file exists but no SHA-256 verifier is available" >&2
    exit 1
  fi
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

read_schema_version() {
  sqlite3 "$1" "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;" 2>/dev/null || echo "0"
}

LATEST_SCHEMA_VERSION="0"
if [ -f "$MIGRATION_PLAN_PATH" ]; then
  LATEST_SCHEMA_VERSION="$(grep -o 'defineMigration([[:space:]]*[0-9]\+' "$MIGRATION_PLAN_PATH" | sed -E 's/.*\(([[:space:]]*[0-9]+).*/\1/' | tr -d ' ' | sort -n | tail -1)"
  LATEST_SCHEMA_VERSION="${LATEST_SCHEMA_VERSION:-0}"
fi

BACKUP_SCHEMA_VERSION="$(read_schema_version "$BACKUP_PATH")"
if [ "$BACKUP_SCHEMA_VERSION" -gt "$LATEST_SCHEMA_VERSION" ]; then
  echo "ERROR: Backup schema version ${BACKUP_SCHEMA_VERSION} is newer than repository migration head ${LATEST_SCHEMA_VERSION}" >&2
  exit 1
fi

if [ -f "$DB_PATH" ]; then
  CURRENT_SCHEMA_VERSION="$(read_schema_version "$DB_PATH")"
  if [ "$CURRENT_SCHEMA_VERSION" -gt "$BACKUP_SCHEMA_VERSION" ] && [ "${AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE:-0}" != "1" ]; then
    echo "ERROR: Refusing schema downgrade from ${CURRENT_SCHEMA_VERSION} to ${BACKUP_SCHEMA_VERSION}. Set AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE=1 to override." >&2
    exit 1
  fi
fi

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
TMP_RESTORE_PATH="${DB_PATH}.restore.$$"
cp "$BACKUP_PATH" "$TMP_RESTORE_PATH" || {
  echo "ERROR: Failed to copy backup to target DB path." >&2
  echo "Pre-restore snapshot available at: $PRE_RESTORE" >&2
  exit 1
}

TMP_INTEGRITY=$(sqlite3 "$TMP_RESTORE_PATH" "PRAGMA integrity_check;" 2>&1) || {
  echo "ERROR: Restored temp database failed integrity check: $TMP_INTEGRITY" >&2
  exit 1
}
if [ "$TMP_INTEGRITY" != "ok" ]; then
  echo "ERROR: Restored temp database integrity check failed: $TMP_INTEGRITY" >&2
  exit 1
fi

rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
mv -f "$TMP_RESTORE_PATH" "$DB_PATH"
TMP_RESTORE_PATH=""

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
