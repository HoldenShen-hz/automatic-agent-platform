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
#   AA_DB_PATH      SQLite database path (default: data/sqlite/automatic-agent.db)
#   BACKUP_DIR     Backup directory (default: backups)
#   RETENTION_DAYS Number of days to retain backups (default: 7)
#   AA_BACKUP_ENCRYPTION_KEY_FILE  Optional OpenSSL passphrase file for AES-256 encryption
#   AA_BACKUP_REMOTE_URI           Optional remote destination (rclone remote or s3:// bucket)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${REPO_ROOT}/backups"
CIPHER="aes-256-cbc"
CHECKSUM_PATH=""

DB_PATH="${1:-${AA_DB_PATH:-data/sqlite/automatic-agent.db}}"
BACKUP_DIR="${2:-${BACKUP_DIR:-backups}}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
BACKUP_SUCCESS=0

resolve_abs_path() {
  local path="$1"
  local base="$2"
  node -e 'const path = require("node:path"); process.stdout.write(path.resolve(process.argv[1], process.argv[2]));' "$base" "$path"
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

validate_sqlite_meta_path() {
  local path="$1"
  if [[ "$path" == *$'\n'* || "$path" == *$'\r'* || "$path" == *";"* || "$path" == *"\\"* || "$path" == *"'"* ]]; then
    echo "ERROR: backup path contains unsupported sqlite meta-command characters: ${path}" >&2
    exit 2
  fi
}

validate_remote_uri() {
  local uri="$1"
  if [[ "$uri" =~ ^s3://[a-z0-9][a-z0-9.-]{1,61}[a-z0-9](/[^[:space:]]*)?$ ]]; then
    return 0
  fi
  if [[ "$uri" =~ ^[A-Za-z0-9._-]+:[^[:space:]-][^[:space:]]*$ ]]; then
    return 0
  fi
  echo "ERROR: AA_BACKUP_REMOTE_URI is not an approved remote destination: ${uri}" >&2
  exit 2
}

DB_PATH="$(resolve_abs_path "$DB_PATH" "$REPO_ROOT")"
BACKUP_DIR="$(resolve_abs_path "$BACKUP_DIR" "$REPO_ROOT")"
require_repo_subpath "$BACKUP_DIR" "$BACKUP_ROOT" "BACKUP_DIR"
mkdir -p "$(dirname "$DB_PATH")"
LOCK_DIR="${BACKUP_DIR}/.backup_lock.d"

generate_timestamp() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
from datetime import datetime
print(datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f"))
PY
    return
  fi
  if command -v perl >/dev/null 2>&1; then
    perl -MTime::HiRes=time -MPOSIX=strftime -e 'my $t=time; my $sec=int($t); my $micros=int(($t-$sec)*1_000_000); print strftime("%Y%m%d_%H%M%S", gmtime($sec)) . sprintf("_%06d\n", $micros);'
    return
  fi
  date +%Y%m%d_%H%M%S
}

TIMESTAMP="$(generate_timestamp | tr -d '\n')"
BACKUP_PATH="${BACKUP_DIR}/backup_${TIMESTAMP}.db"
ENCRYPTED_BACKUP_PATH="${BACKUP_PATH}.enc"
UPLOAD_ACK_PATH="${BACKUP_PATH}.uploaded"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Safety: refuse to run if a backup is already in progress.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ERROR: Backup already in progress. refusing to start." >&2
  exit 3
fi
echo $$ > "${LOCK_DIR}/pid"
cleanup() {
  rm -rf "$LOCK_DIR"
  if [ "$BACKUP_SUCCESS" -ne 1 ]; then
    rm -f "$BACKUP_PATH" "${BACKUP_PATH}.sha256" "$ENCRYPTED_BACKUP_PATH" "${ENCRYPTED_BACKUP_PATH}.sha256" "$UPLOAD_ACK_PATH"
  fi
}
trap cleanup EXIT

# SQLite online backup (WAL-safe — does not require db lock)
echo "Starting backup: $DB_PATH -> $BACKUP_PATH"
validate_sqlite_meta_path "$BACKUP_PATH"
sqlite3 "$DB_PATH" ".timeout 5000" ".backup '$BACKUP_PATH'" || {
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

if [ -n "${AA_BACKUP_ENCRYPTION_KEY_FILE:-}" ]; then
  if [ ! -f "$AA_BACKUP_ENCRYPTION_KEY_FILE" ]; then
    echo "ERROR: AA_BACKUP_ENCRYPTION_KEY_FILE does not exist: $AA_BACKUP_ENCRYPTION_KEY_FILE" >&2
    rm -f "$BACKUP_PATH"
    exit 1
  fi
  openssl enc -"${CIPHER}" -salt -pbkdf2 -iter 200000 -md sha256 \
    -pass "file:${AA_BACKUP_ENCRYPTION_KEY_FILE}" \
    -in "$BACKUP_PATH" \
    -out "$ENCRYPTED_BACKUP_PATH"
  chmod 0600 "$ENCRYPTED_BACKUP_PATH"
  rm -f "$BACKUP_PATH"
  BACKUP_PATH="$ENCRYPTED_BACKUP_PATH"
  BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
  echo "Encrypted backup created: $BACKUP_PATH ($BACKUP_SIZE)"
fi

if command -v shasum >/dev/null 2>&1; then
  CHECKSUM_PATH="${BACKUP_PATH}.sha256"
  shasum -a 256 "$BACKUP_PATH" > "$CHECKSUM_PATH"
elif command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM_PATH="${BACKUP_PATH}.sha256"
  sha256sum "$BACKUP_PATH" > "$CHECKSUM_PATH"
else
  echo "WARN: no SHA-256 tool available; checksum sidecar not written" >&2
fi

if [ -n "${AA_BACKUP_REMOTE_URI:-}" ]; then
  validate_remote_uri "$AA_BACKUP_REMOTE_URI"
  upload_failed=0
  if command -v rclone >/dev/null 2>&1; then
    rclone copyto "$BACKUP_PATH" "${AA_BACKUP_REMOTE_URI%/}/$(basename "$BACKUP_PATH")" || upload_failed=1
    if [ -n "$CHECKSUM_PATH" ]; then
      rclone copyto "$CHECKSUM_PATH" "${AA_BACKUP_REMOTE_URI%/}/$(basename "$CHECKSUM_PATH")" || upload_failed=1
    fi
  elif command -v aws >/dev/null 2>&1 && [[ "$AA_BACKUP_REMOTE_URI" == s3://* ]]; then
    if [ -n "${AA_BACKUP_S3_KMS_KEY_ID:-}" ]; then
      aws s3 cp "$BACKUP_PATH" "${AA_BACKUP_REMOTE_URI%/}/$(basename "$BACKUP_PATH")" \
        --sse aws:kms \
        --sse-kms-key-id "$AA_BACKUP_S3_KMS_KEY_ID" || upload_failed=1
    else
      aws s3 cp "$BACKUP_PATH" "${AA_BACKUP_REMOTE_URI%/}/$(basename "$BACKUP_PATH")" \
        --sse AES256 || upload_failed=1
    fi
    if [ -n "$CHECKSUM_PATH" ]; then
      aws s3 cp "$CHECKSUM_PATH" "${AA_BACKUP_REMOTE_URI%/}/$(basename "$CHECKSUM_PATH")" \
        --sse AES256 || upload_failed=1
    fi
  else
    echo "ERROR: remote backup requested but neither rclone nor compatible aws s3 is available" >&2
    rm -f "$BACKUP_PATH" "$CHECKSUM_PATH"
    exit 4
  fi
  if [ "$upload_failed" -ne 0 ]; then
    echo "ERROR: remote backup upload failed; removing incomplete local backup artifact" >&2
    rm -f "$BACKUP_PATH" "$CHECKSUM_PATH"
    exit 5
  fi
  : > "$UPLOAD_ACK_PATH"
  echo "Remote backup copied to: ${AA_BACKUP_REMOTE_URI%/}/$(basename "$BACKUP_PATH")"
fi

BACKUP_SUCCESS=1

# Clean up backups older than RETENTION_DAYS
COUNT_BEFORE=$(find "$BACKUP_DIR" \( -name "backup_*.db" -o -name "backup_*.db.enc" -o -name "backup_*.db.sha256" -o -name "backup_*.db.enc.sha256" \) -type f 2>/dev/null | wc -l | tr -d ' ')
while IFS= read -r candidate; do
  base_without_suffix="${candidate%.sha256}"
  ack_path="${base_without_suffix}.uploaded"
  if [ -n "${AA_BACKUP_REMOTE_URI:-}" ] && [ ! -f "$ack_path" ]; then
    continue
  fi
  rm -f "$candidate" "${candidate}.sha256"
  if [ "$candidate" = "$base_without_suffix" ]; then
    rm -f "$ack_path"
  fi
done < <(find "$BACKUP_DIR" -maxdepth 1 \( -name "backup_*.db" -o -name "backup_*.db.enc" \) -type f -mtime "+${RETENTION_DAYS}" | sort)
COUNT_AFTER=$(find "$BACKUP_DIR" \( -name "backup_*.db" -o -name "backup_*.db.enc" -o -name "backup_*.db.sha256" -o -name "backup_*.db.enc.sha256" \) -type f 2>/dev/null | wc -l | tr -d ' ')
DELETED=$((COUNT_BEFORE - COUNT_AFTER))
if [ "$DELETED" -gt 0 ]; then
  echo "Cleaned up $DELETED old backup(s) older than ${RETENTION_DAYS} days."
fi

echo "Done."
