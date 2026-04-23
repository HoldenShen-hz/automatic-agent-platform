export const CONTROL_PLANE_LOAD_BALANCING_DDL = `
CREATE TABLE IF NOT EXISTS coordinator_instance_snapshots (
  coordinator_id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  role TEXT NOT NULL,
  queue_affinity TEXT NULL,
  status TEXT NOT NULL,
  max_concurrent_dispatches INTEGER NOT NULL,
  active_dispatch_count INTEGER NOT NULL,
  backlog_count INTEGER NOT NULL,
  cpu_pct REAL NULL,
  shard_json TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  metadata_json TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coordinator_instance_status_updated_at
  ON coordinator_instance_snapshots(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_coordinator_instance_region_updated_at
  ON coordinator_instance_snapshots(region, updated_at DESC);
`;
//# sourceMappingURL=control-plane-load-balancing-ddl.js.map