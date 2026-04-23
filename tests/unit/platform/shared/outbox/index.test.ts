import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  OutboxStatus,
  type OutboxRecord,
  type OutboxInsertPayload,
  type OutboxPollResult,
  type OutboxMetrics,
} from "../../../../../src/platform/shared/outbox/index.js";

test("OutboxStatus enum is exported", () => {
  assert.equal(OutboxStatus.PENDING, "pending");
  assert.equal(OutboxStatus.PUBLISHED, "published");
  assert.equal(OutboxStatus.FAILED, "failed");
});

test("OutboxRecord type is exported", () => {
  const record: OutboxRecord = {
    id: "test-id",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };
  assert.equal(record.id, "test-id");
});

test("OutboxInsertPayload type is exported", () => {
  const payload: OutboxInsertPayload = {
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:updated",
    payload: { status: "running" },
  };
  assert.equal(payload.aggregateType, "task");
});

test("OutboxPollResult type is exported", () => {
  const result: OutboxPollResult = {
    published: 5,
    failed: 1,
    errors: [{ id: "err-1", error: "failed" }],
  };
  assert.equal(result.published, 5);
  assert.equal(result.failed, 1);
});

test("OutboxMetrics type is exported", () => {
  const metrics: OutboxMetrics = {
    pendingCount: 10,
    publishedCount: 100,
    failedCount: 5,
    averageLatencyMs: 25.5,
  };
  assert.equal(metrics.pendingCount, 10);
  assert.equal(metrics.publishedCount, 100);
});
