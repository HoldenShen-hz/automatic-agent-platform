import assert from "node:assert/strict";
import test from "node:test";

import {
  OutboxStatus,
  type OutboxRecord,
  type OutboxInsertPayload,
  type OutboxPollResult,
  type OutboxMetrics,
} from "../../../../../src/platform/shared/outbox/outbox-types.js";

test("OutboxStatus enum has correct values", () => {
  assert.equal(OutboxStatus.PENDING, "pending");
  assert.equal(OutboxStatus.PUBLISHED, "published");
  assert.equal(OutboxStatus.FAILED, "failed");
});

test("OutboxRecord interface structure", () => {
  const record: OutboxRecord = {
    id: "outbox-123",
    aggregateType: "task",
    aggregateId: "task-456",
    eventType: "task:status_changed",
    payloadJson: '{"status":"running"}',
    traceId: "trace-abc",
    createdAt: "2026-04-23T00:00:00.000Z",
    publishedAt: "2026-04-23T00:01:00.000Z",
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  assert.equal(record.id, "outbox-123");
  assert.equal(record.aggregateType, "task");
  assert.equal(record.aggregateId, "task-456");
  assert.equal(record.eventType, "task:status_changed");
  assert.equal(record.payloadJson, '{"status":"running"}');
  assert.equal(record.traceId, "trace-abc");
  assert.equal(record.createdAt, "2026-04-23T00:00:00.000Z");
  assert.equal(record.publishedAt, "2026-04-23T00:01:00.000Z");
  assert.equal(record.retryCount, 0);
  assert.equal(record.lastError, null);
  assert.equal(record.lastAttemptAt, null);
});

test("OutboxRecord with null publishedAt indicates not published", () => {
  const record: OutboxRecord = {
    id: "outbox-789",
    aggregateType: "execution",
    aggregateId: "exec-101",
    eventType: "execution:started",
    payloadJson: '{"startedAt":"2026-04-23T00:00:00.000Z"}',
    traceId: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  assert.equal(record.publishedAt, null);
  assert.equal(record.traceId, null);
});

test("OutboxRecord with retry information", () => {
  const record: OutboxRecord = {
    id: "outbox-retry",
    aggregateType: "task",
    aggregateId: "task-retry",
    eventType: "task:failed",
    payloadJson: '{"error":"something went wrong"}',
    traceId: "trace-retry",
    createdAt: "2026-04-23T00:00:00.000Z",
    publishedAt: null,
    retryCount: 3,
    lastError: "Connection timeout",
    lastAttemptAt: "2026-04-23T00:02:00.000Z",
  };

  assert.equal(record.retryCount, 3);
  assert.equal(record.lastError, "Connection timeout");
  assert.equal(record.lastAttemptAt, "2026-04-23T00:02:00.000Z");
  assert.equal(record.publishedAt, null);
});

test("OutboxInsertPayload interface structure", () => {
  const payload: OutboxInsertPayload = {
    aggregateType: "task",
    aggregateId: "task-insert",
    eventType: "task:created",
    payload: { taskName: "My Task", priority: "high" },
    traceId: "trace-insert",
  };

  assert.equal(payload.aggregateType, "task");
  assert.equal(payload.aggregateId, "task-insert");
  assert.equal(payload.eventType, "task:created");
  assert.deepEqual(payload.payload, { taskName: "My Task", priority: "high" });
  assert.equal(payload.traceId, "trace-insert");
});

test("OutboxInsertPayload without optional traceId", () => {
  const payload: OutboxInsertPayload = {
    aggregateType: "workflow",
    aggregateId: "wf-no-trace",
    eventType: "workflow:completed",
    payload: { result: "success" },
  };

  assert.equal(payload.traceId, undefined);
});

test("OutboxInsertPayload with null traceId", () => {
  const payload: OutboxInsertPayload = {
    aggregateType: "workflow",
    aggregateId: "wf-null-trace",
    eventType: "workflow:started",
    payload: { startedAt: "now" },
    traceId: null,
  };

  assert.equal(payload.traceId, null);
});

test("OutboxPollResult interface structure", () => {
  const result: OutboxPollResult = {
    published: 10,
    failed: 2,
    errors: [
      { id: "err-1", error: "Timeout" },
      { id: "err-2", error: "Connection refused" },
    ],
  };

  assert.equal(result.published, 10);
  assert.equal(result.failed, 2);
  assert.equal(result.errors.length, 2);
  const firstError = result.errors[0];
  assert.ok(firstError !== undefined);
  assert.equal(firstError.id, "err-1");
  assert.equal(firstError.error, "Timeout");
});

test("OutboxPollResult with no failures", () => {
  const result: OutboxPollResult = {
    published: 5,
    failed: 0,
    errors: [],
  };

  assert.equal(result.published, 5);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.errors, []);
});

test("OutboxMetrics interface structure", () => {
  const metrics: OutboxMetrics = {
    pendingCount: 100,
    publishedCount: 500,
    failedCount: 10,
    averageLatencyMs: 45.5,
  };

  assert.equal(metrics.pendingCount, 100);
  assert.equal(metrics.publishedCount, 500);
  assert.equal(metrics.failedCount, 10);
  assert.equal(metrics.averageLatencyMs, 45.5);
});

test("OutboxMetrics with zero values", () => {
  const metrics: OutboxMetrics = {
    pendingCount: 0,
    publishedCount: 0,
    failedCount: 0,
    averageLatencyMs: 0,
  };

  assert.equal(metrics.pendingCount, 0);
  assert.equal(metrics.publishedCount, 0);
  assert.equal(metrics.failedCount, 0);
  assert.equal(metrics.averageLatencyMs, 0);
});

test("OutboxStatus can be used in comparisons", () => {
  const status = OutboxStatus.PENDING;
  assert.equal(status, "pending");

  const published: OutboxStatus = OutboxStatus.PUBLISHED;
  assert.equal(published, "published");

  const failed: OutboxStatus = OutboxStatus.FAILED;
  assert.equal(failed, "failed");
});

test("OutboxRecord can be created with all string dates", () => {
  const record: OutboxRecord = {
    id: "outbox-date-test",
    aggregateType: "task",
    aggregateId: "task-date",
    eventType: "task:updated",
    payloadJson: "{}",
    traceId: null,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  // Verify dates are valid ISO strings
  assert.ok(Date.parse(record.createdAt) > 0);
});
