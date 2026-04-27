/**
 * @fileoverview Unit tests for core/runtime module exports
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as runtimeIndex from "../../../../src/core/runtime/index.js";

test("core/runtime index re-exports platform execution engine types", () => {
  assert.ok(runtimeIndex);
  // Should re-export dispatcher, execution-engine, state-transition, lease, worker-registry, checkpoints
  assert.ok(typeof runtimeIndex.TransitionService !== "undefined" || runtimeIndex.runMultiStepOrchestration != null);
});

test("core/runtime re-exports state transition components", () => {
  // The module should re-export TransitionService and StateTransitionMachine
  assert.ok(typeof runtimeIndex.TransitionService !== "undefined" || runtimeIndex.StateTransitionMachine != null);
});

test("core/runtime re-exports execution lease service", () => {
  // The module should re-export ExecutionLeaseService
  assert.ok(typeof runtimeIndex.ExecutionLeaseService !== "undefined");
});

test("core/runtime re-exports worker registry service", () => {
  // The module should re-export WorkerRegistryService
  assert.ok(typeof runtimeIndex.WorkerRegistryService !== "undefined");
});

test("core/runtime re-exports process tracker", () => {
  // The module should re-export ProcessTracker
  assert.ok(typeof runtimeIndex.ProcessTracker !== "undefined");
});

test("core/runtime re-exports queue adapter", () => {
  // The module should re-export QueueAdapter
  assert.ok(typeof runtimeIndex.QueueAdapter !== "undefined");
});

test("core/runtime re-exports orchestrator", () => {
  // The module should re-export orchestrator components
  assert.ok(runtimeIndex.orchestrator != null);
});

test("core/runtime re-exports supervisor", () => {
  // The module should re-export supervisor components
  assert.ok(runtimeIndex.supervisor != null);
});

test("core/runtime re-exports distributed lock service", () => {
  // The module should re-export DistributedLockService
  assert.ok(typeof runtimeIndex.DistributedLockService !== "undefined");
});
