/**
 * Migration runtime part 4 - Contains migrations 51 and beyond.
 *
 * This file contains later migrations that were added after the initial
 * schema foundation was established.
 */

/**
 * Migration 45: Adds version column to worker_snapshots for optimistic concurrency control.
 * R11-12/R25.3/R25.10: Enables CAS (Compare-And-Swap) pattern to detect concurrent modifications.
 */
export const WORKER_SNAPSHOT_VERSION_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
`;

/**
 * Migration 51: Adds persistent CAS (Compare-And-Swap) records table.
 * R16-35: CAS service now persists records to SQLite instead of in-memory Map.
 */
export const CAS_RECORDS_SQL = `
CREATE TABLE IF NOT EXISTS cas_records (
  cas_key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cas_records_version ON cas_records(version);
`;

/**
 * Migration 54: Adds persistent fence records table for distributed fencing backends.
 * R22-41: FencingTokenService needs a durable/shared repository instead of process-local memory.
 */
export const FENCE_RECORDS_SQL = `
CREATE TABLE IF NOT EXISTS fence_records (
  fence_key TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  owner_node_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('shared', 'exclusive')),
  fence_token TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_fence_records_execution_id ON fence_records(execution_id);
CREATE INDEX IF NOT EXISTS idx_fence_records_owner_node_id ON fence_records(owner_node_id);
CREATE INDEX IF NOT EXISTS idx_fence_records_expires_at ON fence_records(expires_at);
`;

/**
 * Migration 46: Adds config versioning and rollout persistence tables.
 * R15-78/R15-79: Makes config snapshots, rollback points, and canary rollout state durable across restart.
 */
export const CONFIG_ROLLOUT_PERSISTENCE_SQL = `
CREATE TABLE IF NOT EXISTS config_version_snapshots (
  version_id TEXT PRIMARY KEY,
  config_path TEXT NOT NULL,
  layer TEXT NOT NULL,
  source_id TEXT NULL,
  content_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NULL,
  reason TEXT NULL,
  parent_version_id TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_config_version_snapshots_path
  ON config_version_snapshots(config_path, layer, source_id, created_at);

CREATE TABLE IF NOT EXISTS config_rollback_points (
  rollback_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  config_path TEXT NOT NULL,
  layer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_config_rollback_points_path
  ON config_rollback_points(config_path, layer, created_at);

CREATE TABLE IF NOT EXISTS config_rollouts (
  rollout_id TEXT PRIMARY KEY,
  config_path TEXT NOT NULL,
  layer TEXT NOT NULL,
  source_id TEXT NULL,
  stage_phase TEXT NOT NULL,
  stage_percentage INTEGER NOT NULL,
  stage_min_duration_ms INTEGER NOT NULL,
  stage_auto_progress INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  target_percentage INTEGER NOT NULL,
  current_percentage INTEGER NOT NULL,
  metadata_json TEXT NULL,
  health_gates_json TEXT NOT NULL,
  last_health_check_at TEXT NULL,
  last_health_check_passed INTEGER NULL
);
CREATE INDEX IF NOT EXISTS idx_config_rollouts_lookup
  ON config_rollouts(config_path, layer, source_id, updated_at);
`;

/**
 * Migration 55: Add canonical node_run_id to legacy artifacts for R6-19 migration.
 */
export const ARTIFACT_NODE_RUN_ID_SQL = `
ALTER TABLE artifacts ADD COLUMN node_run_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_artifacts_node_run_id ON artifacts(task_id, node_run_id, created_at);
`;
