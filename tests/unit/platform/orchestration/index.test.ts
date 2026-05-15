import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  HitlApprovalOrchestrationService,
  OapeflirLoopService,
  TaskDecompositionService,
} from "../../../../src/platform/five-plane-orchestration/index.js";

test("orchestration root barrel exposes harness, HITL, OAPEFLIR, and planner services", () => {
  assert.equal(typeof HarnessRuntimeService, "function");
  assert.equal(typeof HitlApprovalOrchestrationService, "function");
  assert.equal(typeof OapeflirLoopService, "function");
  assert.equal(typeof TaskDecompositionService, "function");
});
