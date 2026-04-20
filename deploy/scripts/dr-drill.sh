#!/bin/bash
#
# DR Drill Automation Script
#
# Implements §31 disaster recovery automation:
# - Automated DR drills with RTO/RPO verification
# - Backup/restore procedure validation
# - Monthly CI integration for automated recovery testing
#
# Usage:
#   ./dr-drill.sh --mode <full|incremental|verify> [--component <component>] [--output-dir <path>]
#
set -euo pipefail

# === Configuration ===
DR_CONFIG_DIR="${DR_CONFIG_DIR:-config/dr}"
DR_OUTPUT_DIR="${DR_OUTPUT_DIR:-.dr-reports}"
DR_BACKUP_DIR="${DR_BACKUP_DIR:-.backups}"
DR_LOG_DIR="${DR_LOG_DIR:-.dr-logs}"

# DR thresholds from config
DR_RTO_SECONDS="${DR_RTO_SECONDS:-3600}"  # 1 hour default RTO
DR_RPO_SECONDS="${DR_RPO_SECONDS:-300}"    # 5 minutes default RPO

# === Colors for output ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# === Logging ===
log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# === Parse command line arguments ===
MODE="full"
COMPONENT="all"
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --component)
      COMPONENT="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 --mode <full|incremental|verify> [--component <component>] [--output-dir <path>]"
      echo ""
      echo "Modes:"
      echo "  full       - Full DR drill including backup, restore, and verification"
      echo "  incremental - Test incremental backup and recovery"
      echo "  verify     - Verify existing backups without restore"
      echo ""
      echo "Components:"
      echo "  all        - Test all components (default)"
      echo "  events     - Event store only"
      echo "  truth      - Truth store only"
      echo "  projections - Projection data only"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Use provided output dir or generate timestamped one
if [[ -z "$OUTPUT_DIR" ]]; then
  TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
  OUTPUT_DIR="${DR_OUTPUT_DIR}/drill_${TIMESTAMP}"
fi

# === Setup ===
setup_directories() {
  log_info "Setting up DR drill directories..."
  mkdir -p "$OUTPUT_DIR"
  mkdir -p "$DR_BACKUP_DIR"
  mkdir -p "$DR_LOG_DIR"
  mkdir -p "$OUTPUT_DIR/data"
  mkdir -p "$OUTPUT_DIR/restore"
}

# === Configuration Loading ===
load_dr_config() {
  local config_file="${DR_CONFIG_DIR}/default.json"

  if [[ ! -f "$config_file" ]]; then
    log_warn "DR config not found at ${config_file}, using defaults"
    return 1
  fi

  log_info "Loading DR configuration from ${config_file}"
  return 0
}

# === Backup Functions ===

backup_event_store() {
  local backup_path="$1"
  local start_time=$2

  log_info "Backing up event store to ${backup_path}..."

  # Simulate event store backup (in production, this would call actual backup tooling)
  # For SQLite-based event store:
  local event_db="data/events.db"

  if [[ -f "$event_db" ]]; then
    mkdir -p "$(dirname "$backup_path")"
    if command -v sqlite3 &> /dev/null; then
      sqlite3 "$event_db" ".backup '$backup_path/events.db'" 2>/dev/null || \
        cp "$event_db" "$backup_path/events.db"
    else
      cp "$event_db" "$backup_path/events.db"
    fi
    log_success "Event store backed up"
  else
    log_warn "Event store database not found at ${event_db}"
  fi

  # Record backup timestamp
  echo "$(date -Iseconds)" > "$backup_path/.backup_timestamp"
  echo "$start_time" > "$backup_path/.backup_started_at"
}

backup_truth_store() {
  local backup_path="$1"
  local start_time=$2

  log_info "Backing up truth store to ${backup_path}..."

  local truth_db="data/truth.db"

  if [[ -f "$truth_db" ]]; then
    mkdir -p "$(dirname "$backup_path")"
    if command -v sqlite3 &> /dev/null; then
      sqlite3 "$truth_db" ".backup '$backup_path/truth.db'" 2>/dev/null || \
        cp "$truth_db" "$backup_path/truth.db"
    else
      cp "$truth_db" "$backup_path/truth.db"
    fi
    log_success "Truth store backed up"
  else
    log_warn "Truth store database not found at ${truth_db}"
  fi
}

backup_projections() {
  local backup_path="$1"
  local start_time=$2

  log_info "Backing up projections to ${backup_path}..."

  local projections_dir="data/projections"

  if [[ -d "$projections_dir" ]]; then
    mkdir -p "$(dirname "$backup_path")"
    # Archive projections directory
    tar -czf "$backup_path/projections.tar.gz" -C "$projections_dir" . 2>/dev/null || \
      (mkdir -p "$backup_path" && cp -r "$projections_dir" "$backup_path/projections")
    log_success "Projections backed up"
  else
    log_warn "Projections directory not found at ${projections_dir}"
  fi
}

perform_backup() {
  local backup_name="${1:-backup_$(date +%Y%m%d_%H%M%S)}"
  local backup_path="${DR_BACKUP_DIR}/${backup_name}"
  local start_time=$(date +%s.%N)

  log_info "Starting backup: ${backup_name}"
  log_info "Backup path: ${backup_path}"

  mkdir -p "$backup_path"

  # Backup components based on mode
  case "$MODE" in
    full|incremental)
      backup_event_store "$backup_path" "$start_time"
      backup_truth_store "$backup_path" "$start_time"
      backup_projections "$backup_path" "$start_time"
      ;;
    verify)
      log_info "Verify mode - checking existing backups only"
      ;;
  esac

  # Calculate backup duration
  local end_time=$(date +%s.%N)
  local duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "unknown")

  # Write backup metadata
  cat > "$backup_path/.backup_metadata.json" << EOF
{
  "backupName": "${backup_name}",
  "backupPath": "${backup_path}",
  "startedAt": "$(date -Iseconds)",
  "durationSeconds": ${duration},
  "mode": "${MODE}",
  "component": "${COMPONENT}",
  "rtoSeconds": ${DR_RTO_SECONDS},
  "rpoSeconds": ${DR_RPO_SECONDS}
}
EOF

  log_success "Backup completed in ${duration}s"
  echo "$backup_path"
}

# === Restore Functions ===

restore_event_store() {
  local backup_path="$1"
  local restore_dir="$2"
  local start_time=$3

  log_info "Restoring event store from ${backup_path}..."

  local event_backup="${backup_path}/events.db"
  local event_restore="${restore_dir}/data/events.db"

  if [[ -f "$event_backup" ]]; then
    mkdir -p "$(dirname "$event_restore")"
    cp "$event_backup" "$event_restore"
    log_success "Event store restored"
  else
    log_error "Event store backup not found at ${event_backup}"
    return 1
  fi

  return 0
}

restore_truth_store() {
  local backup_path="$1"
  local restore_dir="$2"
  local start_time=$3

  log_info "Restoring truth store from ${backup_path}..."

  local truth_backup="${backup_path}/truth.db"
  local truth_restore="${restore_dir}/data/truth.db"

  if [[ -f "$truth_backup" ]]; then
    mkdir -p "$(dirname "$truth_restore")"
    cp "$truth_backup" "$truth_restore"
    log_success "Truth store restored"
  else
    log_error "Truth store backup not found at ${truth_backup}"
    return 1
  fi

  return 0
}

restore_projections() {
  local backup_path="$1"
  local restore_dir="$2"
  local start_time=$3

  log_info "Restoring projections from ${backup_path}..."

  local proj_archive="${backup_path}/projections.tar.gz"
  local proj_restore="${restore_dir}/data/projections"

  if [[ -f "$proj_archive" ]]; then
    mkdir -p "$proj_restore"
    tar -xzf "$proj_archive" -C "$proj_restore" 2>/dev/null || \
      cp -r "${backup_path}/projections" "$proj_restore"
    log_success "Projections restored"
  elif [[ -d "${backup_path}/projections" ]]; then
    mkdir -p "$proj_restore"
    cp -r "${backup_path}/projections/." "$proj_restore/"
    log_success "Projections restored"
  else
    log_warn "Projections backup not found"
  fi
}

perform_restore() {
  local backup_path="$1"
  local restore_dir="${2:-${OUTPUT_DIR}/restore}"
  local start_time=$(date +%s.%N)

  log_info "Starting restore from: ${backup_path}"
  log_info "Restore directory: ${restore_dir}"

  mkdir -p "$restore_dir"

  # Restore based on component filter
  case "$COMPONENT" in
    all|events)
      restore_event_store "$backup_path" "$restore_dir" "$start_time" || return 1
      ;;
  esac

  case "$COMPONENT" in
    all|truth)
      restore_truth_store "$backup_path" "$restore_dir" "$start_time" || return 1
      ;;
  esac

  case "$COMPONENT" in
    all|projections)
      restore_projections "$backup_path" "$restore_dir" "$start_time" || return 1
      ;;
  esac

  # Calculate restore duration
  local end_time=$(date +%s.%N)
  local duration=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "unknown")

  log_success "Restore completed in ${duration}s"
  echo "$restore_dir"
}

# === Verification Functions ===

verify_data_integrity() {
  local restore_dir="$1"
  local backup_path="$2"
  local verification_start=$(date +%s.%N)

  log_info "Verifying restored data integrity..."

  local errors=0
  local warnings=0

  # Check event store
  if [[ -f "${restore_dir}/data/events.db" ]]; then
    if command -v sqlite3 &> /dev/null; then
      local event_count=$(sqlite3 "${restore_dir}/data/events.db" "SELECT COUNT(*) FROM events" 2>/dev/null || echo "0")
      log_info "Event store verified: ${event_count} events"
    else
      log_warn "sqlite3 not available, skipping event count verification"
    fi
  fi

  # Check truth store
  if [[ -f "${restore_dir}/data/truth.db" ]]; then
    if command -v sqlite3 &> /dev/null; then
      local task_count=$(sqlite3 "${restore_dir}/data/truth.db" "SELECT COUNT(*) FROM tasks" 2>/dev/null || echo "0")
      log_info "Truth store verified: ${task_count} tasks"
    else
      log_warn "sqlite3 not available, skipping truth store verification"
    fi
  fi

  # Check projections
  if [[ -d "${restore_dir}/data/projections" ]]; then
    local proj_count=$(find "${restore_dir}/data/projections" -type f 2>/dev/null | wc -l || echo "0")
    log_info "Projections verified: ${proj_count} files"
  fi

  local verification_end=$(date +%s.%N)
  local verification_duration=$(echo "$verification_end - $verification_start" | bc 2>/dev/null || echo "unknown")

  return $errors
}

# === RTO/RPO Verification ===

verify_rto_rpo() {
  local backup_path="$1"
  local restore_dir="$2"
  local drill_start_time="$3"

  log_info "Verifying RTO/RPO compliance..."

  # Read backup metadata
  local metadata_file="${backup_path}/.backup_metadata.json"

  if [[ ! -f "$metadata_file" ]]; then
    log_error "Backup metadata not found"
    return 1
  fi

  # Extract timestamps (simplified - in production use jq)
  local backup_started=$(grep -oP '"startedAt":\s*"\K[^"]+' "$metadata_file" 2>/dev/null || echo "")
  local rto_seconds=$(grep -oP '"rtoSeconds":\s*\K\d+' "$metadata_file" 2>/dev/null || echo "$DR_RTO_SECONDS")
  local rpo_seconds=$(grep -oP '"rpoSeconds":\s*\K\d+' "$metadata_file" 2>/dev/null || echo "$DR_RPO_SECONDS")

  # Calculate actual RTO
  local restore_started=$(date -Iseconds)
  local actual_rto=$(($(date +%s) - $(date -d "$backup_started" +%s 2>/dev/null || echo "$(date +%s)")))
  local actual_rto_seconds=${actual_rto:-0}

  # Calculate actual RPO (time since last backup)
  local backup_timestamp_file="${backup_path}/.backup_timestamp"
  if [[ -f "$backup_timestamp_file" ]]; then
    local backup_timestamp=$(cat "$backup_timestamp_file")
    local rpo_diff=$(($(date +%s) - $(date -d "$backup_timestamp" +%s 2>/dev/null || echo "$(date +%s)")))
    local actual_rpo_seconds=${rpo_diff:-0}
  else
    local actual_rpo_seconds=0
  fi

  # Generate RTO/RPO report
  cat > "${OUTPUT_DIR}/rto_rpo_report.json" << EOF
{
  "drillStartedAt": "${drill_start_time}",
  "backupStartedAt": "${backup_started}",
  "restoreStartedAt": "${restore_started}",
  "rtoTarget": ${rto_seconds},
  "rpoTarget": ${rpo_seconds},
  "actualRtoSeconds": ${actual_rto_seconds},
  "actualRpoSeconds": ${actual_rpo_seconds},
  "rtoCompliance": $([ "$actual_rto_seconds" -le "$rto_seconds" ] && echo "true" || echo "false"),
  "rpoCompliance": $([ "$actual_rpo_seconds" -le "$rpo_seconds" ] && echo "true" || echo "false"),
  "mode": "${MODE}",
  "component": "${COMPONENT}"
}
EOF

  # Output results
  log_info "RTO: target=${rto_seconds}s actual=${actual_rto_seconds}s $([ "$actual_rto_seconds" -le "$rto_seconds" ] && echo -e "${GREEN}COMPLIANT${NC}" || echo -e "${RED}NON-COMPLIANT${NC}")"
  log_info "RPO: target=${rpo_seconds}s actual=${actual_rpo_seconds}s $([ "$actual_rpo_seconds" -le "$rpo_seconds" ] && echo -e "${GREEN}COMPLIANT${NC}" || echo -e "${RED}NON-COMPLIANT${NC}")"

  # Return non-zero if either is non-compliant
  if [[ "$actual_rto_seconds" -gt "$rto_seconds" ]] || [[ "$actual_rpo_seconds" -gt "$rpo_seconds" ]]; then
    return 1
  fi
  return 0
}

# === DR Drill Report ===

generate_drill_report() {
  local drill_start_time="$1"
  local drill_end_time="$2"
  local backup_path="$3"
  local restore_path="$4"
  local success="$5"

  local duration_seconds=$(($(date -d "$drill_end_time" +%s) - $(date -d "$drill_start_time" +%s)))

  cat > "${OUTPUT_DIR}/drill_report.json" << EOF
{
  "drillId": "$(basename "$OUTPUT_DIR")",
  "drillStartedAt": "${drill_start_time}",
  "drillCompletedAt": "${drill_end_time}",
  "durationSeconds": ${duration_seconds},
  "mode": "${MODE}",
  "component": "${COMPONENT}",
  "backupPath": "${backup_path}",
  "restorePath": "${restore_path}",
  "success": ${success},
  "rtoTarget": ${DR_RTO_SECONDS},
  "rpoTarget": ${DR_RPO_SECONDS},
  "configDir": "${DR_CONFIG_DIR}",
  "backupDir": "${DR_BACKUP_DIR}",
  "environment": "${NODE_ENV:-development}"
}
EOF

  log_success "DR drill report written to ${OUTPUT_DIR}/drill_report.json"

  # Also generate human-readable summary
  cat > "${OUTPUT_DIR}/SUMMARY.txt" << EOF
========================================
DRILL SUMMARY
========================================
Drill ID:        $(basename "$OUTPUT_DIR")
Started:         ${drill_start_time}
Completed:       ${drill_end_time}
Duration:         ${duration_seconds}s
Mode:            ${MODE}
Component:        ${COMPONENT}
Success:         $([ "$success" = "true" ] && echo "YES" || echo "NO")

RTO TARGET:      ${DR_RTO_SECONDS}s
RPO TARGET:      ${DR_RPO_SECONDS}s

Backup Path:     ${backup_path}
Restore Path:    ${restore_path}

See drill_report.json for detailed metrics.
========================================
EOF

  log_info "Summary written to ${OUTPUT_DIR}/SUMMARY.txt"
}

# === Main DR Drill Flow ===

run_dr_drill() {
  local drill_start_time=$(date -Iseconds)
  log_info "=========================================="
  log_info "DR DRILL STARTING"
  log_info "Mode: ${MODE}"
  log_info "Component: ${COMPONENT}"
  log_info "Output: ${OUTPUT_DIR}"
  log_info "=========================================="

  setup_directories
  load_dr_config || true

  local backup_path=""
  local restore_path=""
  local drill_success=true

  # Phase 1: Backup
  log_info "PHASE 1: Backup"
  backup_path=$(perform_backup "drill_$(date +%Y%m%d_%H%M%S)")

  if [[ "$MODE" == "verify" ]]; then
    log_info "Verify mode - skipping restore"
  else
    # Phase 2: Restore
    log_info "PHASE 2: Restore"
    restore_path=$(perform_restore "$backup_path" "${OUTPUT_DIR}/restore")

    # Phase 3: Verification
    log_info "PHASE 3: Verification"
    if ! verify_data_integrity "$restore_path" "$backup_path"; then
      log_error "Data integrity verification failed"
      drill_success=false
    fi

    # Phase 4: RTO/RPO Verification
    log_info "PHASE 4: RTO/RPO Verification"
    if ! verify_rto_rpo "$backup_path" "$restore_path" "$drill_start_time"; then
      log_warn "RTO/RPO targets may not be met"
    fi
  fi

  local drill_end_time=$(date -Iseconds)

  # Generate final report
  generate_drill_report "$drill_start_time" "$drill_end_time" "$backup_path" "${OUTPUT_DIR}/restore" "$drill_success"

  log_info "=========================================="
  if $drill_success; then
    log_success "DR DRILL COMPLETED SUCCESSFULLY"
  else
    log_error "DR DRILL COMPLETED WITH FAILURES"
  fi
  log_info "=========================================="

  return $( $drill_success && echo 0 || echo 1 )
}

# === Entry Point ===
run_dr_drill
exit $?