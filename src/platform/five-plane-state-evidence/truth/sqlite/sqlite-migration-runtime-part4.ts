/**
 * Migration runtime part 4 - Contains migrations 51 and beyond.
 *
 * This file contains later migrations that were added after the initial
 * schema foundation was established.
 */

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
 * Migration 55: Add canonical node_run_id to legacy artifacts for R6-19 migration.
 */
export const ARTIFACT_NODE_RUN_ID_SQL = `
ALTER TABLE artifacts ADD COLUMN node_run_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_artifacts_node_run_id ON artifacts(task_id, node_run_id, created_at);
`;
