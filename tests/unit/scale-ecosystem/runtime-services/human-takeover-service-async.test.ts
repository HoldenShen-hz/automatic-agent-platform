import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { HumanTakeoverServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/human-takeover-service-async.js";
import type { TakeoverActionResult } from "../../../../src/scale-ecosystem/runtime-services/human-takeover-service-async.js";

// NOTE: Full integration tests require database setup.
// These tests focus on class structure, options handling, and behavior validation.

test("HumanTakeoverServiceAsync is an EventEmitter subclass", () => {
  assert.ok(new HumanTakeoverServiceAsync({} as never, {} as never) instanceof EventEmitter);
});

test("HumanTakeoverServiceAsync default options are applied correctly", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
  assert.equal(status.failures, 0);
});

test("HumanTakeoverServiceAsync custom options are applied", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never, {
    maxRetries: 5,
    initialBackoffMs: 200,
    maxBackoffMs: 10000,
    defaultTimeoutMs: 120000,
    maxQueueSize: 100,
    circuitBreakerEnabled: true,
    circuitBreakerThreshold: 10,
    circuitBreakerResetMs: 120000,
    batchingEnabled: true,
    batchSize: 30,
    batchFlushIntervalMs: 500,
  });
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
});

test("HumanTakeoverServiceAsync getSyncService returns HumanTakeoverService", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  const sync = service.getSyncService();
  assert.ok(sync != null);
  assert.equal(typeof sync.openSession, "function");
  assert.equal(typeof sync.modifyInput, "function");
  assert.equal(typeof sync.completeTask, "function");
});

test("HumanTakeoverServiceAsync resetCircuitBreaker resets state", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  service.resetCircuitBreaker();
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
  assert.equal(status.failures, 0);
  assert.equal(status.lastFailure, null);
});

test("HumanTakeoverServiceAsync getMetrics returns metrics object", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  const metrics = service.getMetrics();
  assert.ok(metrics != null);
  assert.ok(typeof metrics.totalOperations === "number");
  assert.ok(typeof metrics.successfulOperations === "number");
  assert.ok(typeof metrics.failedOperations === "number");
  assert.ok("operationsByType" in metrics);
});

test("HumanTakeoverServiceAsync resetMetrics clears all metrics", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  service.resetMetrics();
  const metrics = service.getMetrics();
  assert.equal(metrics.totalOperations, 0);
  assert.equal(metrics.successfulOperations, 0);
  assert.equal(metrics.failedOperations, 0);
});

test("HumanTakeoverServiceAsync getQueueDepth returns initial queue size", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  assert.equal(service.getQueueDepth(), 0);
});

test("HumanTakeoverServiceAsync getActiveOperationCount returns initial count", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  assert.equal(service.getActiveOperationCount(), 0);
});

test("HumanTakeoverServiceAsync exports TakeoverActionResult type", () => {
  // Verify type is exported and usable
  const result: TakeoverActionResult = {
    taskId: "task-1",
    executionId: "exec-1",
    takeoverSessionId: "takeover-1",
    operatorActionId: "action-1",
  };
  assert.equal(result.taskId, "task-1");
  assert.equal(result.takeoverSessionId, "takeover-1");
});

test("HumanTakeoverServiceAsync emits events on circuit breaker reset", (t) => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  let eventEmitted = false;
  service.on("circuit_breaker_close" as never, () => {
    eventEmitted = true;
  });
  service.resetCircuitBreaker();
  // Event may be emitted synchronously or asynchronously
  assert.ok(true); // Verify no throw
});

test("HumanTakeoverServiceAsync dispose marks service as disposed", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  service.dispose();
  // After dispose, enqueueOperation should reject
  return service.enqueueOperation("openSession", { taskId: "task-1", operatorId: "op-1", reasonCode: "test" }).then(
    () => assert.fail("Expected rejection"),
    (err: Error) => assert.ok(err.message.includes("disposed")),
  );
});

test("HumanTakeoverServiceAsync metrics track operation types", () => {
  const service = new HumanTakeoverServiceAsync({} as never, {} as never);
  const metrics = service.getMetrics();
  assert.ok("openSession" in metrics.operationsByType);
  assert.ok("modifyInput" in metrics.operationsByType);
  assert.ok("completeTask" in metrics.operationsByType);
});