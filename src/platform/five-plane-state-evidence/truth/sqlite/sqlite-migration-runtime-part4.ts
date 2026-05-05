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
