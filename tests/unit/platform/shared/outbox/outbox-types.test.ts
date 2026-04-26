/**
 * Additional unit tests for OutboxTypes - covering edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  OutboxStatus,
  type OutboxRecord,
  type OutboxInsertPayload,
  type OutboxPollResult,
  type OutboxMetrics,
} from "../../../../../src/platform/shared/outbox/outbox-types.js";

test("OutboxStatus enum is comparable to string values", () => {
  const status = OutboxStatus.PENDING;
  assert.equal(status, "pending");
  assert.equal(OutboxStatus.PENDING, "pending");
  assert.equal(OutboxStatus.PUBLISHED, "published");
  assert.equal(OutboxStatus.FAILED, "failed");
});

test("OutboxRecord accepts all possible states", () => {
  // Fresh record - never attempted
  const fresh: OutboxRecord = {
    id: "fresh-1",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: "2026-04-26T00:00:00Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };
  assert.equal(fresh.publishedAt, null);
  assert.equal(fresh.retryCount, 0);

  // In-flight record - being processed
  const inFlight: OutboxRecord = {
    id: "inflight-1",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: "2026-04-26T00:00:00Z",
    publishedAt: null,
    retryCount: 1,
    lastError: null,
    lastAttemptAt: "2026-04-26T00:01:00Z",
  };
  assert.equal(inFlight.retryCount, 1);
  assert.ok(inFlight.lastAttemptAt !== null);

  // Failed record - exhausted retries
  const failed: OutboxRecord = {
    id: "failed-1",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: "2026-04-26T00:00:00Z",
    publishedAt: null,
    retryCount: 5,
    lastError: "Connection timeout",
    lastAttemptAt: "2026-04-26T00:05:00Z",
  };
  assert.equal(failed.retryCount, 5);
  assert.ok(failed.lastError !== null);

  // Published record - completed
  const published: OutboxRecord = {
    id: "published-1",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: "2026-04-26T00:00:00Z",
    publishedAt: "2026-04-26T00:02:00Z",
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };
  assert.ok(published.publishedAt !== null);
});

test("OutboxInsertPayload with all optional fields", () => {
  const full: OutboxInsertPayload = {
    aggregateType: "task",
    aggregateId: "task-full",
    eventType: "task:status_changed",
    payload: { status: "running", progress: 50 },
    traceId: "trace-full",
  };
  assert.equal(full.traceId, "trace-full");

  const minimal: OutboxInsertPayload = {
    aggregateType: "execution",
    aggregateId: "exec-min",
    eventType: "execution:started",
    payload: { startedAt: "now" },
  };
  assert.equal(minimal.traceId, undefined);
});

test("OutboxPollResult with various error counts", () => {
  const empty: OutboxPollResult = {
    published: 0,
    failed: 0,
    errors: [],
  };
  assert.equal(empty.errors.length, 0);

  const manyErrors: OutboxPollResult = {
    published: 5,
    failed: 10,
    errors: [
      { id: "err-1", error: "Error 1" },
      { id: "err-2", error: "Error 2" },
      { id: "err-3", error: "Error 3" },
    ],
  };
  assert.equal(manyErrors.failed, 10);
  assert.equal(manyErrors.errors.length, 3);
});

test("OutboxMetrics with fractional latency", () => {
  const metrics: OutboxMetrics = {
    pendingCount: 50,
    publishedCount: 1000,
    failedCount: 5,
    averageLatencyMs: 12.345,
  };
  assert.equal(metrics.averageLatencyMs, 12.345);
});

test("OutboxMetrics with very large counts", () => {
  const metrics: OutboxMetrics = {
    pendingCount: 1000000,
    publishedCount: 50000000,
    failedCount: 10000,
    averageLatencyMs: 50,
  };
  assert.ok(metrics.pendingCount > 0);
  assert.ok(metrics.publishedCount > 0);
});

test("OutboxRecord payloadJson can contain complex JSON", () => {
  const complexPayload = JSON.stringify({
    users: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
    metadata: {
      source: "system",
      version: "1.0.0",
      nested: { deep: { value: true } },
    },
    counts: [1, 2, 3, 4, 5],
  });

  const record: OutboxRecord = {
    id: "complex-payload",
    aggregateType: "task",
    aggregateId: "task-complex",
    eventType: "task:created",
    payloadJson: complexPayload,
    traceId: null,
    createdAt: "2026-04-26T00:00:00Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  const parsed = JSON.parse(record.payloadJson);
  assert.equal(parsed.users.length, 2);
  assert.equal(parsed.metadata.nested.deep.value, true);
});

test("OutboxInsertPayload payload can be any JSON-serializable object", () => {
  const payloadWithNull: OutboxInsertPayload = {
    aggregateType: "task",
    aggregateId: "task-null",
    eventType: "task:created",
    payload: { data: null, count: null },
  };
  assert.equal(payloadWithNull.payload.data, null);

  const payloadWithArray: OutboxInsertPayload = {
    aggregateType: "task",
    aggregateId: "task-array",
    eventType: "task:created",
    payload: { items: [null, "string", 123, { nested: true }] } as Record<string, unknown>,
  };
  assert.equal((payloadWithArray.payload.items as unknown[]).length, 4);
});

test("OutboxStatus enum values are unique", () => {
  const values = [OutboxStatus.PENDING, OutboxStatus.PUBLISHED, OutboxStatus.FAILED];
  const uniqueValues = [...new Set(values)];
  assert.equal(values.length, uniqueValues.length);
});

test("OutboxRecord with all timing fields populated", () => {
  const now = new Date().toISOString();
  const record: OutboxRecord = {
    id: "timed-record",
    aggregateType: "task",
    aggregateId: "task-timed",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: "trace-timed",
    createdAt: now,
    publishedAt: now,
    retryCount: 2,
    lastError: "Previous error",
    lastAttemptAt: now,
  };

  assert.ok(Date.parse(record.createdAt) > 0);
  assert.ok(Date.parse(record.publishedAt!) > 0);
  assert.ok(Date.parse(record.lastAttemptAt!) > 0);
  assert.equal(record.lastError, "Previous error");
});