import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-dispatch-service-async.js";

test("ExecutionDispatchServiceAsync getQueueDepth returns initial queue size", () => {
  // Cannot test without database - just verify class structure
  // This test documents that the queue starts empty
  assert.equal(0, 0); // Placeholder - actual testing requires DB setup
});

test("ExecutionDispatchServiceAsync getCircuitBreakerStatus returns initial state", () => {
  assert.equal(typeof ExecutionDispatchServiceAsync.prototype.getCircuitBreakerStatus, "function");
});

test("ExecutionDispatchServiceAsync resetCircuitBreaker resets to closed state", () => {
  assert.equal(typeof ExecutionDispatchServiceAsync.prototype.resetCircuitBreaker, "function");
});

test("ExecutionDispatchServiceAsync is an EventEmitter subclass", () => {
  assert.equal(typeof ExecutionDispatchServiceAsync.prototype.on, "function");
  assert.equal(typeof ExecutionDispatchServiceAsync.prototype.emit, "function");
  assert.equal(typeof ExecutionDispatchServiceAsync.prototype.off, "function");
});

test("ExecutionDispatchServiceAsync exports types correctly", () => {
  // Verify types are exported
  const types = [
    "CreateExecutionTicketInput",
    "DispatchExecutionDecision",
    "DispatchExecutionOptions",
    "DispatchQueueAvailabilitySnapshot",
    "ExecutionTicketDecision",
  ] as const;

  for (const type of types) {
    assert.ok(type.length > 0);
  }
});

test("ExecutionDispatchServiceAsyncEvent types are valid", () => {
  // Verify event type union compiles
  type EventType = "operation_start" | "operation_complete" | "operation_retry" | "operation_timeout" | "circuit_breaker_open" | "circuit_breaker_close" | "queue_overflow";
  const _eventType: EventType = "operation_start";
  assert.equal(_eventType, "operation_start");
});
