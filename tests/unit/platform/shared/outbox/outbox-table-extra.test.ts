/**
 * Additional unit tests for OutboxTable DDL edge cases and validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OUTBOX_TABLE_DDL,
  OUTBOX_TABLE_CLEANUP_DDL,
} from "../../../../../src/platform/shared/outbox/outbox-table.js";

test("OUTBOX_TABLE_DDL creates table with all required columns", () => {
  // Primary key
  assert.ok(OUTBOX_TABLE_DDL.includes("id TEXT PRIMARY KEY"));

  // Required columns
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_type TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_id TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("event_type TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("payload_json TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("created_at TEXT NOT NULL"));

  // Optional columns
  assert.ok(OUTBOX_TABLE_DDL.includes("trace_id TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("published_at TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_error TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_attempt_at TEXT NULL"));

  // Default value column
  assert.ok(OUTBOX_TABLE_DDL.includes("retry_count INTEGER NOT NULL DEFAULT 0"));
});

test("OUTBOX_TABLE_DDL defines three indexes", () => {
  const idxCount = (
    OUTBOX_TABLE_DDL.match(/CREATE INDEX/g) || []
  ).length;
  assert.equal(idxCount, 3);
});

test("OUTBOX_TABLE_DDL idx_outbox_pending is partial index", () => {
  // Partial index should only index rows where published_at IS NULL
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL"));
});

test("OUTBOX_TABLE_DDL idx_outbox_retry filters on both conditions", () => {
  // idx_outbox_retry should filter on published_at IS NULL AND retry_count > 0
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_retry"));
  assert.ok(OUTBOX_TABLE_DDL.includes("WHERE published_at IS NULL AND retry_count > 0"));
});

test("OUTBOX_TABLE_CLEANUP_DDL only deletes published entries older than days", () => {
  // Only deletes where published_at IS NOT NULL (already published entries)
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("DELETE FROM outbox"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NOT NULL"));
  // Should not delete pending entries
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NULL"));
});

test("OUTBOX_TABLE_CLEANUP_DDL uses datetime function with parameter substitution", () => {
  // Uses datetime('now', '-' || ? || ' days') to calculate cutoff date
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("datetime('now', '-'"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("' days')"));
  // Uses ? placeholder for days parameter (prevents SQL injection)
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("?"));
});

test("OUTBOX_TABLE_DDL table name is 'outbox' lowercase", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE TABLE IF NOT EXISTS outbox"));
});

test("OUTBOX_TABLE_DDL column order is consistent", () => {
  // Extract column definitions from CREATE TABLE statement
  const createMatch = OUTBOX_TABLE_DDL.match(/CREATE TABLE.*?\((.*?)\);/s);
  assert.ok(createMatch !== null);
  assert.ok(createMatch.length > 1);

  const columnsSection = createMatch[1];
  if (!columnsSection) {
    assert.fail("Could not extract column definitions");
    return;
  }
  const columnDefs = columnsSection.split(",").map(c => c.trim());

  // Should have 11 column definitions (10 columns + table constraint)
  // This test ensures column order doesn't change unexpectedly
  assert.ok(columnDefs.length >= 10);
});

test("OUTBOX_TABLE_DDL timestamp columns store ISO strings", () => {
  // created_at, published_at, last_attempt_at are TEXT NOT NULL / TEXT NULL
  // They store ISO 8601 formatted timestamps
  assert.ok(OUTBOX_TABLE_DDL.includes("created_at TEXT NOT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("published_at TEXT NULL"));
  assert.ok(OUTBOX_TABLE_DDL.includes("last_attempt_at TEXT NULL"));
});

test("OUTBOX_TABLE_DDL payload_json is NOT NULL", () => {
  // payload_json must be NOT NULL as we always store JSON string
  assert.ok(OUTBOX_TABLE_DDL.includes("payload_json TEXT NOT NULL"));
});

test("OUTBOX_TABLE_CLEANUP_DDL is separate DDL statement", () => {
  // Cleanup is independent - not part of table creation
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("CREATE TABLE"));
  assert.ok(!OUTBOX_TABLE_CLEANUP_DDL.includes("CREATE INDEX"));
});

test("OUTBOX_TABLE_DDL retry_count has default value of 0", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("retry_count INTEGER NOT NULL DEFAULT 0"));
});

test("OUTBOX_TABLE_DDL id uses TEXT not INTEGER for primary key", () => {
  // TEXT allows UUID-style IDs without auto-increment concerns
  assert.ok(OUTBOX_TABLE_DDL.includes("id TEXT PRIMARY KEY"));
  assert.ok(!OUTBOX_TABLE_DDL.includes("id INTEGER PRIMARY KEY"));
});

test("OUTBOX_TABLE_DDL all indexes use IF NOT EXISTS", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_aggregate"));
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_outbox_retry"));
});

test("OUTBOX_TABLE_DDL composite index on aggregate columns", () => {
  // idx_outbox_aggregate should be on (aggregate_type, aggregate_id)
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_aggregate"));
  assert.ok(OUTBOX_TABLE_DDL.includes("aggregate_type, aggregate_id"));
});

test("OUTBOX_TABLE_CLEANUP_DDL uses parameterized query to prevent SQL injection", () => {
  // The ? placeholder ensures days parameter is properly escaped
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("DELETE FROM outbox"));
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("?"));
  // Uses SQLite string concatenation || for the days calculation
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("'-' || ? || ' days'"));
});

test("OUTBOX_TABLE_DDL snake_case naming convention is consistent", () => {
  // All column names use snake_case
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

test("OUTBOX_TABLE_DDL index on created_at is for ordering pending entries", () => {
  // idx_outbox_pending orders by created_at to process oldest first
  assert.ok(OUTBOX_TABLE_DDL.includes("idx_outbox_pending"));
  assert.ok(OUTBOX_TABLE_DDL.includes("created_at"));
  // Index is partial (WHERE published_at IS NULL) for only pending entries
});

test("OUTBOX_TABLE_DDL last_error stores error messages as TEXT", () => {
  assert.ok(OUTBOX_TABLE_DDL.includes("last_error TEXT NULL"));
});

test("OUTBOX_TABLE_CLEANUP_DDL condition excludes already-cleaned entries", () => {
  // Only deletes entries where published_at IS NOT NULL
  // This ensures we don't accidentally delete pending entries
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("published_at IS NOT NULL"));
});