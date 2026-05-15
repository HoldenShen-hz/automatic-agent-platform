import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionLeaseService,
  HaCoordinatorService,
  TransitionService,
  executeToolCall,
  resetToolRegistry,
} from "../../../../src/platform/five-plane-execution/index.js";

test("execution root barrel exposes canonical execution plane services", () => {
  assert.equal(typeof executeToolCall, "function");
  assert.equal(typeof resetToolRegistry, "function");
  assert.equal(typeof ExecutionLeaseService, "function");
  assert.equal(typeof HaCoordinatorService, "function");
  assert.equal(typeof TransitionService, "function");
});
