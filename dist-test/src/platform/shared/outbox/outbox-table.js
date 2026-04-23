/**
 * Outbox Table DDL
 *
 * SQLite schema for the transactional outbox pattern.
 * The outbox table stores events that will be asynchronously published
 * to the event bus by the outbox poller service.
 */
export const OUTBOX_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  trace_id TEXT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  last_attempt_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(created_at)
WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox(aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_outbox_retry ON outbox(retry_count)
WHERE published_at IS NULL AND retry_count > 0;
`.trim();
export const OUTBOX_TABLE_CLEANUP_DDL = `
DELETE FROM outbox
WHERE published_at IS NOT NULL
  AND created_at < datetime('now', '-' || ? || ' days');
`;
//# sourceMappingURL=outbox-table.js.map