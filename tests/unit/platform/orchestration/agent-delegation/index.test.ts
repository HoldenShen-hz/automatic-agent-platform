import assert from "node:assert/strict";
import test from "node:test";

// Agent Delegation orchestration barrel
import {
  DelegationManagerService,
  DelegationTracker,
  ContextIsolator,
  TopologyValidator,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
  type DelegationSpec,
  type DelegationResult,
  type DelegationStatus,
  type DelegationOptions,
} from "../../../../../../src/platform/orchestration/agent-delegation/index.js";

test("DelegationManagerService is exported as function", () => {
  assert.equal(typeof DelegationManagerService, "function");
});

test("DelegationTracker is exported as function", () => {
  assert.equal(typeof DelegationTracker, "function");
});

test("ContextIsolator is exported as function", () => {
  assert.equal(typeof ContextIsolator, "function");
});

test("TopologyValidator is exported as function", () => {
  assert.equal(typeof TopologyValidator, "function");
});

test("DelegationDepthExceededError is exported as error class", () => {
  assert.equal(typeof DelegationDepthExceededError, "function");
  const error = new DelegationDepthExceededError(5, 3);
  assert.ok(error instanceof Error);
});

test("DelegationFanoutExceededError is exported as error class", () => {
  assert.equal(typeof DelegationFanoutExceededError, "function");
  const error = new DelegationFanoutExceededError(10, 5);
  assert.ok(error instanceof Error);
});

test("DelegationCycleDetectedError is exported as error class", () => {
  assert.equal(typeof DelegationCycleDetectedError, "function");
  const error = new DelegationCycleDetectedError(["a", "b", "a"]);
  assert.ok(error instanceof Error);
});

test("DelegationSpec type works correctly", () => {
  const spec: DelegationSpec = {
    sourceAgentId: "agent-001",
    targetAgentId: "agent-002",
    permissions: { canDelegate: true, canExecute: true, canRead: true },
  };
  assert.equal(spec.sourceAgentId, "agent-001");
  assert.equal(spec.targetAgentId, "agent-002");
});

test("DelegationStatus type works correctly", () => {
  const status: DelegationStatus = "active";
  assert.equal(status, "active");
});

test("DelegationOptions type works correctly", () => {
  const options: DelegationOptions = {
    timeoutMs: 30000,
    retryOnFailure: true,
  };
  assert.equal(options.timeoutMs, 30000);
  assert.equal(options.retryOnFailure, true);
});

test("DelegationManagerService can be instantiated", () => {
  const service = new DelegationManagerService();
  assert.ok(service !== undefined);
});

test("DelegationTracker can be instantiated", () => {
  const tracker = new DelegationTracker();
  assert.ok(tracker !== undefined);
});

test("ContextIsolator can be instantiated", () => {
  const isolator = new ContextIsolator();
  assert.ok(isolator !== undefined);
});

test("TopologyValidator can be instantiated", () => {
  const validator = new TopologyValidator();
  assert.ok(validator !== undefined);
});
