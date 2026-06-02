#!/usr/bin/env bash
# =============================================================================
# SQLite Restore Script
# =============================================================================
# Restores SQLite database from a backup file created by backup-sqlite.sh.
# Creates a pre-restore snapshot of the current DB before restoring.
#
# Usage:
#   ./restore-sqlite.sh BACKUP_PATH [DB_PATH] [--confirm-schema-downgrade]
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
DATA_ROOT="${REPO_ROOT}/data"
MIGRATION_PLAN_PATH="${REPO_ROOT}/src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.ts"
CIPHER="aes-256-cbc"

usage() {
  echo "Usage: $0 BACKUP_PATH [DB_PATH] [--confirm-schema-downgrade]" >&2
}

resolve_abs_path() {
  node -e 'const path = require("node:path"); process.stdout.write(path.resolve(process.argv[1], process.argv[2]));' "$1" "$2"
}

require_repo_subpath() {
  local path="$1"
  local root="$2"
  local label="$3"
  case "$path" in
    "$root") ;;
    "$root"/*) ;;
    *)
      echo "ERROR: ${label} must stay within ${root}: ${path}" >&2
      exit 2
      ;;
  esac
}

CONFIRM_SCHEMA_DOWNGRADE=0
POSITIONAL_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --confirm-schema-downgrade)
      CONFIRM_SCHEMA_DOWNGRADE=1
      ;;
    --*)
      usage
      echo "ERROR: Unknown flag: $arg" >&2
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$arg")
      ;;
  esac
done

if [ "${#POSITIONAL_ARGS[@]}" -lt 1 ] || [ "${#POSITIONAL_ARGS[@]}" -gt 2 ]; then
  usage
  echo "ERROR: Expected BACKUP_PATH plus optional DB_PATH and --confirm-schema-downgrade flag" >&2
  exit 1
fi

BACKUP_PATH="${POSITIONAL_ARGS[0]}"
DB_PATH="${POSITIONAL_ARGS[1]:-${AA_DB_PATH:-data/sqlite/automatic-agent.db}}"
DECRYPTED_BACKUP_PATH=""
TMP_RESTORE_PATH=""
RESTORE_LOCK_DIR=""

# Resolve absolute paths
BACKUP_PATH="$(resolve_abs_path "$REPO_ROOT" "$BACKUP_PATH")"
DB_PATH="$(resolve_abs_path "$REPO_ROOT" "$DB_PATH")"
require_repo_subpath "$DB_PATH" "$DATA_ROOT" "DB_PATH"
mkdir -p "$(dirname "$DB_PATH")"
BACKUP_PATH="$(realpath "$BACKUP_PATH" 2>/dev/null)" || {
  echo "ERROR: Cannot resolve backup path: $BACKUP_PATH" >&2
  exit 1
}
RESTORE_LOCK_DIR="$(dirname "$DB_PATH")/.restore_lock.d"

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
  DECRYPTED_BACKUP_PATH="$(mktemp "${TMPDIR:-/tmp}/aa-restore.XXXXXX")"
  openssl enc -d -"${CIPHER}" -pbkdf2 -iter 200000 -md sha256 \
    -pass "file:${AA_BACKUP_ENCRYPTION_KEY_FILE}" \
    -in "$BACKUP_PATH" \
    -out "$DECRYPTED_BACKUP_PATH"
  BACKUP_PATH="$DECRYPTED_BACKUP_PATH"
fi

if ! mkdir "$RESTORE_LOCK_DIR" 2>/dev/null; then
  echo "ERROR: Restore already in progress. refusing to start." >&2
  exit 1
fi

trap 'rm -f "$DECRYPTED_BACKUP_PATH" "$TMP_RESTORE_PATH"; rm -rf "$RESTORE_LOCK_DIR"' EXIT

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

read_latest_schema_version() {
  if [ ! -f "$MIGRATION_PLAN_PATH" ]; then
    echo "ERROR: Migration plan not found: $MIGRATION_PLAN_PATH" >&2
    exit 1
  fi
  local latest
  latest="$(node - "$MIGRATION_PLAN_PATH" <<'NODE'
const fs = require("node:fs");
const source = fs.readFileSync(process.argv[2], "utf8");
const stripped = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");
const matches = [...stripped.matchAll(/defineMigration\(\s*(\d+)/g)].map((entry) => Number.parseInt(entry[1], 10));
if (matches.length === 0) {
  console.error("No migrations found in migration plan.");
  process.exit(1);
}
const latest = Math.max(...matches);
process.stdout.write(String(latest));
NODE
)" || {
    echo "ERROR: Could not determine repository migration head." >&2
    exit 1
  }
  if ! [[ "$latest" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Repository migration head is not numeric: $latest" >&2
    exit 1
  fi
  printf '%s\n' "$latest"
}

LATEST_SCHEMA_VERSION="$(read_latest_schema_version)"

BACKUP_SCHEMA_VERSION="$(read_schema_version "$BACKUP_PATH")"
if [ "$BACKUP_SCHEMA_VERSION" -gt "$LATEST_SCHEMA_VERSION" ]; then
  echo "ERROR: Backup schema version ${BACKUP_SCHEMA_VERSION} is newer than repository migration head ${LATEST_SCHEMA_VERSION}" >&2
  exit 1
fi

if [ -f "$DB_PATH" ]; then
  CURRENT_SCHEMA_VERSION="$(read_schema_version "$DB_PATH")"
  if [ "$CURRENT_SCHEMA_VERSION" -gt "$BACKUP_SCHEMA_VERSION" ]; then
    if [ "${AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE:-0}" != "1" ] || [ "$CONFIRM_SCHEMA_DOWNGRADE" -ne 1 ]; then
      echo "ERROR: Refusing schema downgrade from ${CURRENT_SCHEMA_VERSION} to ${BACKUP_SCHEMA_VERSION}. Set AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE=1 and pass --confirm-schema-downgrade to override." >&2
      exit 1
    fi
  fi
fi

# Create pre-restore safety copy
PRE_RESTORE="${DB_PATH}.pre-restore.$(date +%s)"
if [ -f "$DB_PATH" ]; then
  echo "Creating pre-restore snapshot: $PRE_RESTORE"
  ESCAPED_PRE_RESTORE=${PRE_RESTORE//\'/\'\'}
  sqlite3 "$DB_PATH" ".timeout 5000" ".backup '$ESCAPED_PRE_RESTORE'" || {
    echo "ERROR: Failed to create WAL-safe pre-restore snapshot." >&2
    exit 1
  }
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

if [ -f "$DB_PATH" ]; then
  echo "Applying restore via sqlite .restore (WAL-safe)"
  ESCAPED_TMP_RESTORE=${TMP_RESTORE_PATH//\'/\'\'}
  sqlite3 "$DB_PATH" ".timeout 5000" ".restore '$ESCAPED_TMP_RESTORE'" || {
    echo "ERROR: SQLite restore command failed." >&2
    echo "Pre-restore snapshot available at: $PRE_RESTORE" >&2
    exit 1
  }
  rm -f "$TMP_RESTORE_PATH"
else
  mv -f "$TMP_RESTORE_PATH" "$DB_PATH"
fi
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
