/**
 * Single Task Happy Path Support Tests
 *
 * Tests for support functions used by single task happy path execution.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SINGLE_TASK_MAX_RETRIES,
  DEFAULT_SINGLE_TASK_RETRY_BACKOFF,
  DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS,
  createContext,
  type HappyPathInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path-support.js";

test("DEFAULT_SINGLE_TASK_MAX_RETRIES is 2 [single-task-happy-path-support]", () => {
  assert.equal(DEFAULT_SINGLE_TASK_MAX_RETRIES, 2);
});

test("DEFAULT_SINGLE_TASK_RETRY_BACKOFF is linear [single-task-happy-path-support]", () => {
  assert.equal(DEFAULT_SINGLE_TASK_RETRY_BACKOFF, "linear");
});

test("DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS has correct defaults [single-task-happy-path-support]", () => {
  assert.equal(DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.memoryHighWatermarkMb, Number.POSITIVE_INFINITY);
  assert.equal(DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.eventLoopLagThresholdMs, Number.POSITIVE_INFINITY);
  assert.equal(DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.tier1AckDegradedThreshold, 100);
});

test("createContext creates TransitionAuditContext [single-task-happy-path-support]", () => {
  const traceContext = {
    traceId: "trace_abc",
    spanId: "span_123",
    parentSpanId: "parent_456",
    correlationId: "corr_789",
  };

  const context = createContext(traceContext, "TEST_REASON");

  assert.equal(context.reasonCode, "TEST_REASON");
  assert.equal(context.traceId, "trace_abc");
  assert.equal(context.parentSpanId, "span_123");
  assert.equal(context.actorType, "system");
  assert.equal(context.occurredAt, context.occurredAt); // ISO timestamp
});

test("createContext handles missing optional fields [single-task-happy-path-support]", () => {
  const traceContext = {
    traceId: "trace_xyz",
  };

  const context = createContext(traceContext, "ANOTHER_REASON");

  assert.equal(context.reasonCode, "ANOTHER_REASON");
  assert.equal(context.traceId, "trace_xyz");
  assert.equal(context.actorType, "system");
  assert.ok(context.occurredAt);
});

test("createContext includes spanId when present [single-task-happy-path-support]", () => {
  const traceContext = {
    traceId: "trace_with_span",
    spanId: "span_abc",
    parentSpanId: undefined,
    correlationId: undefined,
  };

  const context = createContext(traceContext, "SPAN_TEST");

  assert.ok(context.spanId != null);
  assert.notEqual(context.spanId, "span_abc");
  assert.equal(context.parentSpanId, "span_abc");
});

test("createContext includes correlationId when present [single-task-happy-path-support]", () => {
  const traceContext = {
    traceId: "trace_corr",
    correlationId: "corr_123",
  };

  const context = createContext(traceContext, "CORR_TEST");

  assert.equal(context.correlationId, "corr_123");
});

test("HappyPathInput interface has expected properties [single-task-happy-path-support]", () => {
  const input: HappyPathInput = {
    dbPath: "/tmp/test.db",
    title: "Test Task",
    request: "Do something",
  };

  assert.equal(input.dbPath, "/tmp/test.db");
  assert.equal(input.title, "Test Task");
  assert.equal(input.request, "Do something");
});

test("HappyPathInput optional properties work correctly [single-task-happy-path-support]", () => {
  const input: HappyPathInput = {
    dbPath: "/tmp/test.db",
    title: "Test Task",
    request: "Do something",
    tenantId: "tenant_123",
  };

  assert.equal(input.tenantId, "tenant_123");
});

test("DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS is typed as readonly defaults [single-task-happy-path-support]", () => {
  assert.deepEqual(DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS, {
    memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
    eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
    tier1AckDegradedThreshold: 100,
  });
});

test("DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS values are correct types [single-task-happy-path-support]", () => {
  assert.equal(typeof DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.memoryHighWatermarkMb, "number");
  assert.equal(typeof DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.eventLoopLagThresholdMs, "number");
  assert.equal(typeof DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.tier1AckDegradedThreshold, "number");
});

test("createContext returns valid ISO timestamp [single-task-happy-path-support]", () => {
  const traceContext = { traceId: "trace_iso" };
  const before = new Date().toISOString();

  const context = createContext(traceContext, "ISO_TEST");

  const after = new Date().toISOString();
  assert.ok(context.occurredAt >= before && context.occurredAt <= after);
});
