/**
 * Additional unit tests for OutboxTable - covering edge cases and additional DDL details
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OUTBOX_TABLE_DDL,
  OUTBOX_TABLE_CLEANUP_DDL,
} from "../../../../../src/platform/shared/outbox/outbox-table.js";

test("OUTBOX_TABLE_DDL contains all required indexes", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_aggregate"));
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_retry"));
});

test("OUTBOX_TABLE_DDL indexes use IF NOT EXISTS clause", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_aggregate"));
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_retry"));
});

test("OUTBOX_TABLE_DDL column definitions have correct constraints", () => {
  // NOT NULL columns
  assert.ok(OUTBOX_TABLE_DDL.includes("id TEXT PRIMARY KEY"));
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_type TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_id TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("event_type TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("payload_json TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("created_at TEXT NOT NULL"));

  // NULL allowed columns
  assert.ok(OUTBOX_TABLE_DDL.includes("trace_id TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("published_at TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_error TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_attempt_at TEXT NULL"));

  // Default values
  assert.ok(OUTBOX_TABLE_DDL.includes("retry_count INTEGER NOT NULL DEFAULT 0"));
});

test("OUTBOX_TABLE_DDL index on created_at is partial with WHERE clause", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL"));
});

test("OUTBOX_TABLE_DDL aggregate index is composite", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_aggregate"));
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_type, aggregate_id"));
});

test("OUTBOX_TABLE_DDL retry index filters on both published_at and retry_count", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_retry"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL AND retry_count > 0"));
});

test("OUTBOX_TABLE_CLEANUP_DDL only deletes published entries", () => {
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("DELETE FROM outbox"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NOT NULL"));
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NULL"));
});

test("OUTBOX_TABLE_CLEANUP_DDL uses datetime function for age calculation", () => {
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("datetime('now', '-'"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("' days')"));
});

test("OUTBOX_TABLE_CLEANUP_DDL parameter is properly escaped", () => {
  // The ? placeholder prevents SQL injection
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("?"));
});

test("OUTBOX_TABLE_DDL can be split into valid separate statements", () => {
  const statements = OUTBOX_TABLE_DDL.split(';').map(s => s.trim()).filter(Boolean);
  assert.ok(statements.length >= 5, "DDL should have at least 5 statements (1 table + 3 indexes + possible cleanup)");
});

test("OUTBOX_TABLE_DDL uses TEXT for id instead of INTEGER for portability", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("id TEXT PRIMARY KEY"));
  assert.ok(!OUTBOX_TABLE_DDL.includes("id INTEGER PRIMARY KEY"));
});

test("OUTBOX_TABLE_DDL uses snake_case for column names", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_type"));
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_id"));
  assert.ok(OUTBOX_TABLE_DDL.includes("event_type"));
  assert.ok(OUTBOX_TABLE_DDL.includes("payload_json"));
  assert.ok(OUTBOX_TABLE_DDL.includes("trace_id"));
  assert.ok(OUTBOX_TABLE_DDL.includes("created_at"));
  assert.ok(OUTBOX_TABLE_DDL.includes("published_at"));
  assert.ok(OUTBOX_TABLE_DDL.includes("retry_count"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_error"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_attempt_at"));
});

test("OUTBOX_TABLE_CLEANUP_DDL is independent of OUTBOX_TABLE_DDL", () => {
  // Cleanup DDL doesn't contain CREATE TABLE
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("CREATE TABLE"));
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("CREATE INDEX"));
});

test("OUTBOX_TABLE_DDL includes proper spacing and line breaks", () => {
  // Just verify it's not a single line (properly formatted)
  assert.ok(OUTBOX_TABLE_DDL.includes("\n"));
});

test("OUTBOX_TABLE_DDL quoted identifiers not used - raw column names", () => {
  // The DDL uses raw identifiers without quotes
  assert.ok(!OUTBOX_TABLE_DDL.includes('"'));
  assert.ok(!OUTBOX_TABLE_DDL.includes("`"));
});