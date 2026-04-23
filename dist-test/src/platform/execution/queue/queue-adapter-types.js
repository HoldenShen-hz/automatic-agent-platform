/**
 * @fileoverview Shared queue adapter types and SQLite DDL.
 */
export const DEFAULT_RETRY_POLICY = {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
};
export const QUEUE_JOBS_DDL = `
CREATE TABLE IF NOT EXISTS queue_jobs (
  id TEXT PRIMARY KEY,
  queue_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT NULL,
  delay_until TEXT NULL,
  idempotency_key TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue_status_priority ON queue_jobs(queue_name, status, priority DESC, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_jobs_idempotency ON queue_jobs(queue_name, idempotency_key) WHERE idempotency_key IS NOT NULL;
`;
//# sourceMappingURL=queue-adapter-types.js.map