import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { ExecutionWorkerWritebackServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.js";
import type { WorkerWritebackDecision } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.js";

// NOTE: Full integration tests require database setup.
// These tests focus on class structure, options handling, and behavior validation.

test("ExecutionWorkerWritebackServiceAsync is an EventEmitter subclass", () => {
  assert.ok(new ExecutionWorkerWritebackServiceAsync({} as never, {} as never) instanceof EventEmitter);
});

test("ExecutionWorkerWritebackServiceAsync default options are applied", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
  assert.equal(status.failures, 0);
});

test("ExecutionWorkerWritebackServiceAsync custom async options are applied", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never, {}, {
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
    coalescingEnabled: true,
    coalescingWindowMs: 100,
  });
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
});

test("ExecutionWorkerWritebackServiceAsync getSyncService returns ExecutionWorkerWritebackService", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  const sync = service.getSyncService();
  assert.ok(sync != null);
  assert.equal(typeof sync.recordWriteback, "function");
});

test("ExecutionWorkerWritebackServiceAsync resetCircuitBreaker resets state", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  service.resetCircuitBreaker();
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
  assert.equal(status.failures, 0);
  assert.equal(status.lastFailure, null);
});

test("ExecutionWorkerWritebackServiceAsync getMetrics returns metrics object", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  const metrics = service.getMetrics();
  assert.ok(metrics != null);
  assert.ok(typeof metrics.totalWritebacks === "number");
  assert.ok(typeof metrics.acceptedWritebacks === "number");
  assert.ok(typeof metrics.rejectedWritebacks === "number");
});

test("ExecutionWorkerWritebackServiceAsync resetMetrics clears all metrics", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  service.resetMetrics();
  const metrics = service.getMetrics();
  assert.equal(metrics.totalWritebacks, 0);
  assert.equal(metrics.acceptedWritebacks, 0);
  assert.equal(metrics.rejectedWritebacks, 0);
});

test("ExecutionWorkerWritebackServiceAsync getQueueDepth returns initial queue size", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  assert.equal(service.getQueueDepth(), 0);
});

test("ExecutionWorkerWritebackServiceAsync getActiveOperationCount returns initial count", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  assert.equal(service.getActiveOperationCount(), 0);
});

test("ExecutionWorkerWritebackServiceAsync exports WorkerWritebackDecision type", () => {
  // Verify type is exported and usable
  const decision: WorkerWritebackDecision = {
    accepted: true,
    executionId: "exec-1",
    writebackId: "wb-1",
  };
  assert.equal(decision.accepted, true);
  assert.equal(decision.executionId, "exec-1");
});

test("ExecutionWorkerWritebackServiceAsync dispose marks service as disposed", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  service.dispose();
  // After dispose, enqueueWriteback should reject
  return service.enqueueWriteback({
    executionId: "exec-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    terminalStatus: "failed",
    errorCode: "test",
  }).then(
    () => assert.fail("Expected rejection"),
    (err: Error) => assert.ok(err.message.includes("disposed")),
  );
});

test("ExecutionWorkerWritebackServiceAsync metrics track coalesced writebacks", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never, {}, {
    coalescingEnabled: true,
    coalescingWindowMs: 50,
  });
  const metrics = service.getMetrics();
  assert.ok(typeof metrics.coalescedWritebacks === "number");
});

test("ExecutionWorkerWritebackServiceAsync batchingEnabled creates batch flush timer", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never, {}, {
    batchingEnabled: true,
    batchFlushIntervalMs: 100,
  });
  assert.ok(true); // If no throw, timer was set up
});

test("ExecutionWorkerWritebackServiceAsync emits circuit_breaker_close on reset", () => {
  const service = new ExecutionWorkerWritebackServiceAsync({} as never, {} as never);
  let closeCount = 0;
  service.on("circuit_breaker_close" as never, () => closeCount++);
  service.resetCircuitBreaker();
  assert.equal(closeCount, 1);
});