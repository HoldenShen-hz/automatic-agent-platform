/**
 * Unit tests for OutboxTable DDL
 */
import assert from "node:assert/strict";
import test from "node:test";
import { OUTBOX_TABLE_DDL, OUTBOX_TABLE_CLEANUP_DDL, } from "../../../../../src/platform/shared/outbox/outbox-table.js";
test("OUTBOX_TABLE_DDL creates outbox table with all required columns", () => {
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE TABLE IF NOT EXISTS outbox"));
    assert.ok(OUTBOX_TABLE_DDL.includes("id TEXT PRIMARY KEY"));
    assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_type TEXT NOT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_id TEXT NOT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("event_type TEXT NOT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("payload_json TEXT NOT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("trace_id TEXT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("created_at TEXT NOT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("published_at TEXT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("retry_count INTEGER NOT NULL DEFAULT 0"));
    assert.ok(OUTBOX_TABLE_DDL.includes("last_error TEXT NULL"));
    assert.ok(OUTBOX_TABLE_DDL.includes("last_attempt_at TEXT NULL"));
});
test("OUTBOX_TABLE_DDL creates pending index on created_at", () => {
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_pending"));
    assert.ok(OUTBOX_TABLE_DDL.includes("ON outbox(created_at)"));
    assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL"));
});
test("OUTBOX_TABLE_DDL creates aggregate index", () => {
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_aggregate"));
    assert.ok(OUTBOX_TABLE_DDL.includes("ON outbox(aggregate_type, aggregate_id)"));
});
test("OUTBOX_TABLE_DDL creates retry index for failed entries", () => {
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_retry"));
    assert.ok(OUTBOX_TABLE_DDL.includes("ON outbox(retry_count)"));
    assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL AND retry_count > 0"));
});
test("OUTBOX_TABLE_CLEANUP_DDL deletes published entries older than N days", () => {
    assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("DELETE FROM outbox"));
    assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NOT NULL"));
    assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("created_at < datetime('now', '-' || ? || ' days')"));
});
test("OUTBOX_TABLE_DDL uses IF NOT EXISTS to be idempotent", () => {
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE TABLE IF NOT EXISTS outbox"));
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_pending"));
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_aggregate"));
    assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_retry"));
});
test("OUTBOX_TABLE_DDL has valid SQL structure", () => {
    // Verify balanced parentheses
    const openParens = (OUTBOX_TABLE_DDL.match(/\(/g) || []).length;
    const closeParens = (OUTBOX_TABLE_DDL.match(/\)/g) || []).length;
    assert.equal(openParens, closeParens, "DDL should have balanced parentheses");
});
test("OUTBOX_TABLE_CLEANUP_DDL uses parameterized query for days", () => {
    // The cleanup DDL uses ? placeholder for the days parameter to prevent SQL injection
    assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("?"));
    assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("datetime('now', '-' || ? || ' days')"));
});
//# sourceMappingURL=outbox-table.test.js.map