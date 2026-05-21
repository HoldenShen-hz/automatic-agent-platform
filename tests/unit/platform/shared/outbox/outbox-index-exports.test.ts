/**
 * Tests for Outbox barrel file exports and type re-exports
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  OutboxRepository,
  OutboxService,
  OutboxPollerService,
  OUTBOX_TABLE_DDL,
  OUTBOX_TABLE_CLEANUP_DDL,
  OutboxStatus,
} from "../../../../../src/platform/shared/outbox/index.js";
import type {
  OutboxRecord,
  OutboxInsertPayload,
  OutboxPollResult,
  OutboxMetrics,
  OutboxServiceConfig,
  TransactionContext,
  OutboxPollerConfig,
  OutboxPollerMetrics,
} from "../../../../../src/platform/shared/outbox/index.js";

test("OUTBOX_TABLE_DDL is exported and is a string", () => {
  assert.equal(typeof OUTBOX_TABLE_DDL, "string");
  assert.ok(OUTBOX_TABLE_DDL.length > 0);
  assert.ok(OUTBOX_TABLE_DDL.includes("CREATE TABLE"));
});

test("OUTBOX_TABLE_CLEANUP_DDL is exported and is a string", () => {
  assert.equal(typeof OUTBOX_TABLE_CLEANUP_DDL, "string");
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.length > 0);
  assert.ok(OUTBOX_TABLE_CLEANUP_DDL.includes("DELETE FROM outbox"));
});

test("OutboxStatus is exported with all values", () => {
  assert.equal(OutboxStatus.PENDING, "pending");
  assert.equal(OutboxStatus.PUBLISHED, "published");
  assert.equal(OutboxStatus.FAILED, "failed");
});

test("OutboxStatus enum values are unique", () => {
  const values = Object.values(OutboxStatus);
  const uniqueValues = [...new Set(values)];
  assert.equal(values.length, uniqueValues.length);
});

test("OutboxRecord type can be instantiated", () => {
  const record: OutboxRecord = {
    id: "test-record-1",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: '{"created":true}',
    traceId: null,
    createdAt: "2026-05-21T00:00:00Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  assert.equal(record.id, "test-record-1");
  assert.equal(record.aggregateType, "task");
  assert.equal(record.publishedAt, null);
});

test("OutboxInsertPayload type can be instantiated", () => {
  const payload: OutboxInsertPayload = {
    aggregateType: "execution",
    aggregateId: "exec-1",
    eventType: "execution:started",
    payload: { startedAt: "now" },
  };

  assert.equal(payload.aggregateType, "execution");
});

test("OutboxInsertPayload with optional traceId", () => {
  const withTrace: OutboxInsertPayload = {
    aggregateType: "task",
    aggregateId: "task-trace",
    eventType: "task:created",
    payload: {},
    traceId: "trace-123",
  };

  const withoutTrace: OutboxInsertPayload = {
    aggregateType: "task",
    aggregateId: "task-no-trace",
    eventType: "task:created",
    payload: {},
  };

  assert.equal(withTrace.traceId, "trace-123");
  assert.equal(withoutTrace.traceId, undefined);
});

test("OutboxPollResult type can be instantiated", () => {
  const result: OutboxPollResult = {
    published: 10,
    failed: 2,
    errors: [
      { id: "err-1", error: "Failed" },
      { id: "err-2", error: "Error" },
    ],
  };

  assert.equal(result.published, 10);
  assert.equal(result.failed, 2);
  assert.equal(result.errors.length, 2);
});

test("OutboxMetrics type can be instantiated", () => {
  const metrics: OutboxMetrics = {
    pendingCount: 50,
    publishedCount: 1000,
    failedCount: 5,
    averageLatencyMs: 25.5,
  };

  assert.equal(metrics.pendingCount, 50);
  assert.ok(metrics.averageLatencyMs > 0);
});

test("OutboxServiceConfig type can be instantiated", () => {
  const config: OutboxServiceConfig = {
    maxBatchSize: 100,
    publishTimeoutMs: 5000,
  };

  assert.equal(config.maxBatchSize, 100);
  assert.equal(config.publishTimeoutMs, 5000);
});

test("TransactionContext interface can be implemented", () => {
  const mockTx: TransactionContext = {
    execute: (sql: string, ...params: unknown[]) => {
      // Mock implementation
      assert.equal(typeof sql, "string");
    },
  };

  mockTx.execute("SELECT 1");
});

test("OutboxPollerConfig type can be instantiated", () => {
  const config: OutboxPollerConfig = {
    intervalMs: 100,
    batchSize: 100,
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
  };

  assert.equal(config.intervalMs, 100);
  assert.equal(config.maxRetries, 5);
});

test("OutboxPollerMetrics type can be instantiated", () => {
  const metrics: OutboxPollerMetrics = {
    isRunning: false,
    lastPollAt: null,
    lastPollDurationMs: 0,
    totalPublished: 0,
    totalFailed: 0,
    pendingCount: 0,
    failedCount: 0,
    consecutiveEmptyPolls: 0,
  };

  assert.equal(metrics.isRunning, false);
  assert.equal(metrics.consecutiveEmptyPolls, 0);
});

test("OutboxRepository class is exported", () => {
  assert.equal(typeof OutboxRepository, "function");
});

test("OutboxService class is exported", () => {
  assert.equal(typeof OutboxService, "function");
});

test("OutboxPollerService class is exported", () => {
  assert.equal(typeof OutboxPollerService, "function");
});

test("All exports are available from barrel file", () => {
  // This test verifies all expected exports exist
  const exports = {
    OUTBOX_TABLE_DDL,
    OUTBOX_TABLE_CLEANUP_DDL,
    OutboxStatus,
    OutboxRepository,
    OutboxService,
    OutboxPollerService,
  };

  assert.ok(exports.OUTBOX_TABLE_DDL);
  assert.ok(exports.OUTBOX_TABLE_CLEANUP_DDL);
  assert.ok(exports.OutboxStatus);
  assert.ok(exports.OutboxRepository);
  assert.ok(exports.OutboxService);
  assert.ok(exports.OutboxPollerService);
});

test("OutboxRecord traceId can be string or null", () => {
  const withTrace: OutboxRecord = {
    id: "trace-record",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: "trace-string",
    createdAt: new Date().toISOString(),
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  const withoutTrace: OutboxRecord = {
    id: "no-trace-record",
    aggregateType: "task",
    aggregateId: "task-2",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  assert.equal(withTrace.traceId, "trace-string");
  assert.equal(withoutTrace.traceId, null);
});

test("OutboxRecord publishedAt can be string or null", () => {
  const unpublished: OutboxRecord = {
    id: "unpublished-record",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  const published: OutboxRecord = {
    id: "published-record",
    aggregateType: "task",
    aggregateId: "task-2",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  assert.equal(unpublished.publishedAt, null);
  assert.ok(published.publishedAt !== null);
});

test("OutboxPollResult errors array is optional", () => {
  const resultWithoutErrors: OutboxPollResult = {
    published: 5,
    failed: 0,
  };

  const resultWithErrors: OutboxPollResult = {
    published: 5,
    failed: 1,
    errors: [{ id: "err-1", error: "Failed" }],
  };

  assert.equal(resultWithoutErrors.errors, undefined);
  assert.equal(resultWithErrors.errors.length, 1);
});