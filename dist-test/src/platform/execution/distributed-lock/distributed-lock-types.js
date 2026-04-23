export const DISTRIBUTED_LOCKS_DDL = `
CREATE TABLE IF NOT EXISTS distributed_locks (
  lock_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  fencing_token INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held',
  acquired_at TEXT NOT NULL,
  ttl_ms INTEGER,
  metadata TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
`;
//# sourceMappingURL=distributed-lock-types.js.map