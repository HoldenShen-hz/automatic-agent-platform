import assert from "node:assert/strict";
import test from "node:test";

import {
  ResourceCeilingGuard,
  createDefaultResourceCeilingGuard,
} from "../../../../../src/platform/five-plane-control-plane/config-center/resource-ceiling.js";

test("ResourceCeilingGuard interface exists", () => {
  // Verify the interface type is available
  const guard: ResourceCeilingGuard | undefined = undefined;
  assert.equal(guard, undefined);
});

test("createDefaultResourceCeilingGuard returns an instance", () => {
  const guard = createDefaultResourceCeilingGuard();
  assert.ok(guard != null);
});

test("createDefaultResourceCeilingGuard returns object with evaluate method", () => {
  const guard = createDefaultResourceCeilingGuard();
  assert.equal(typeof guard.evaluate, "function");
});

test("createDefaultResourceCeilingGuard returns object with firstFinding method", () => {
  const guard = createDefaultResourceCeilingGuard();
  assert.equal(typeof guard.firstFinding, "function");
});

test("createDefaultResourceCeilingGuard firstFinding returns null for empty sample", () => {
  const guard = createDefaultResourceCeilingGuard();
  const result = guard.firstFinding({
    executionId: "exec_1",
    taskId: "task_1",
    agentId: "agent_1",
    status: "in_progress",
    toolCallCount: 0,
    memoryMb: 0,
  });
  assert.equal(result, null);
});
