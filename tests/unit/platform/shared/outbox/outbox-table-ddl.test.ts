/**
 * Tests for OutboxTable DDL - comprehensive schema validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OUTBOX_TABLE_DDL,
  OUTBOX_TABLE_CLEANUP_DDL,
} from "../../../../../src/platform/shared/outbox/outbox-table.js";

test("OUTBOX_TABLE_DDL creates outbox table with correct schema", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE TABLE IF NOT EXISTS outbox"));
});

test("OUTBOX_TABLE_DDL has id as TEXT PRIMARY KEY", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("id TEXT PRIMARY KEY"));
});

test("OUTBOX_TABLE_DDL has aggregate_type as TEXT NOT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_type TEXT NOT NULL"));
});

test("OUTBOX_TABLE_DDL has aggregate_id as TEXT NOT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_id TEXT NOT NULL"));
});

test("OUTBOX_TABLE_DDL has event_type as TEXT NOT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("event_type TEXT NOT NULL"));
});

test("OUTBOX_TABLE_DDL has payload_json as TEXT NOT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("payload_json TEXT NOT NULL"));
});

test("OUTBOX_TABLE_DDL has trace_id as TEXT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("trace_id TEXT NULL"));
});

test("OUTBOX_TABLE_DDL has created_at as TEXT NOT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("created_at TEXT NOT NULL"));
});

test("OUTBOX_TABLE_DDL has published_at as TEXT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("published_at TEXT NULL"));
});

test("OUTBOX_TABLE_DDL has retry_count as INTEGER NOT NULL DEFAULT 0", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("retry_count INTEGER NOT NULL DEFAULT 0"));
});

test("OUTBOX_TABLE_DDL has last_error as TEXT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("last_error TEXT NULL"));
});

test("OUTBOX_TABLE_DDL has last_attempt_at as TEXT NULL", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("last_attempt_at TEXT NULL"));
});

test("OUTBOX_TABLE_DDL defines 3 indexes", () => {
  const indexMatches = OUTBOX_TABLE_DDL.match(/CREATE INDEX/g);
  assert.equal(indexMatches?.length, 3);
});

test("OUTBOX_TABLE_DDL idx_outbox_pending is partial index on created_at", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_pending ON outbox(created_at)"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL"));
});

test("OUTBOX_TABLE_DDL idx_outbox_aggregate is composite on aggregate_type, aggregate_id", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_aggregate"));
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_aggregate ON outbox(aggregate_type, aggregate_id)"));
});

test("OUTBOX_TABLE_DDL idx_outbox_retry is partial with both conditions", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_retry"));
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_retry ON outbox(retry_count)"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL AND retry_count > 0"));
});

test("OUTBOX_TABLE_CLEANUP_DDL uses parameterized placeholder", () => {
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("DELETE FROM outbox"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("?"));
});

test("OUTBOX_TABLE_CLEANUP_DDL only deletes published entries", () => {
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NOT NULL"));
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NULL"));
});

test("OUTBOX_TABLE_CLEANUP_DDL uses datetime function with days parameter", () => {
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("datetime('now', '-'"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("' days')"));
});

test("OUTBOX_TABLE_DDL does not use quoted identifiers", () => {
  assert.ok(!OUTBOX_TABLE_DDL.includes('"'));
  assert.ok(!OUTBOX_TABLE_DDL.includes("`"));
  assert.ok(!OUTBOX_TABLE_DDL.includes("["));
});

test("OUTBOX_TABLE_DDL all column names use snake_case", () => {
  // Verify all column names are snake_case
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

test("OUTBOX_TABLE_CLEANUP_DDL has no CREATE statements", () => {
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("CREATE TABLE"));
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("CREATE INDEX"));
});

test("OUTBOX_TABLE_DDL is valid SQLite DDL", () => {
  // Should be able to split into valid statements
  const statements = OUTBOX_TABLE_DDL.split(';').map(s => s.trim()).filter(Boolean);
  // Should have 4 statements: 1 CREATE TABLE + 3 CREATE INDEX
  assert.ok(statements.length >= 4, `Expected 4 statements, got ${statements.length}`);
});

test("OUTBOX_TABLE_DDL indexes use IF NOT EXISTS clause", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_aggregate"));
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_retry"));
});

test("OUTBOX_TABLE_DDL primary key is on id column", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("id TEXT PRIMARY KEY"));
});

test("OUTBOX_TABLE_DDL payload_json is NOT NULL ensuring JSON always stored", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("payload_json TEXT NOT NULL"));
});

test("OUTBOX_TABLE_DDL timestamp columns store as TEXT for ISO format", () => {
  // created_at, published_at, last_attempt_at should be TEXT (ISO strings)
  assert.ok(OUTBOX_TABLE_DDL.includes("created_at TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("published_at TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_attempt_at TEXT NULL"));
});

test("OUTBOX_TABLE_CLEANUP_DDL uses parameterized query preventing SQL injection", () => {
  // The days parameter uses ? placeholder, not string interpolation
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("?"));
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("${"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("' || ? || ' days'"));
});

test("OUTBOX_TABLE_DDL retry_count default is 0", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("retry_count INTEGER NOT NULL DEFAULT 0"));
});

test("OUTBOX_TABLE_DDL trace_id allows NULL for optional tracing", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("trace_id TEXT NULL"));
});

test("OUTBOX_TABLE_DDL index idx_outbox_pending helps find pending entries efficiently", () => {
  // Partial index on created_at WHERE published_at IS NULL
  // helps the poller find oldest pending entries quickly
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_pending ON outbox(created_at)"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL"));
});

test("OUTBOX_TABLE_DDL index idx_outbox_retry filters for entries needing retry", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_retry ON outbox(retry_count)"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL AND retry_count > 0"));
});
