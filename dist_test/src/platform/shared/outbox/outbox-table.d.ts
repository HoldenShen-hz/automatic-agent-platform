/**
 * Outbox Table DDL
 *
 * SQLite schema for the transactional outbox pattern.
 * The outbox table stores events that will be asynchronously published
 * to the event bus by the outbox poller service.
 */
export declare const OUTBOX_TABLE_DDL: string;
export declare const OUTBOX_TABLE_CLEANUP_DDL = "\nDELETE FROM outbox\nWHERE published_at IS NOT NULL\n  AND created_at < datetime('now', '-' || ? || ' days');\n";
