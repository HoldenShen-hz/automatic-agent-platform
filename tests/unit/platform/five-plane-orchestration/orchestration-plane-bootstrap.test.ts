import assert from "node:assert/strict";
import test from "node:test";

import {
  listOrchestrationCapabilityBaselines,
  resolveOrchestrationCapabilityBaseline,
  ORCHESTRATION_CAPABILITY_BASELINES,
} from "../../../../../../src/platform/five-plane-orchestration/orchestration-plane-baseline.js";

test("listOrchestrationCapabilityBaselines returns all capability baselines", () => {
  const baselines = listOrchestrationCapabilityBaselines();
  assert.ok(baselines.length > 0);
  const ids = baselines.map(b => b.capabilityId);
  assert.ok(ids.includes("agent-delegation"));
  assert.ok(ids.includes("escalation"));
  assert.ok(ids.includes("harness"));
  assert.ok(ids.includes("hitl"));
  assert.ok(ids.includes("oapeflir"));
  assert.ok(ids.includes("planner"));
  assert.ok(ids.includes("replan"));
  assert.ok(ids.includes("routing"));
});

test("ORCHESTRATION_CAPABILITY_BASELINES is frozen", () => {
  assert.ok(Object.isFrozen(ORCHESTRATION_CAPABILITY_BASELINES));
});

test("each baseline has required fields", () => {
  const baselines = listOrchestrationCapabilityBaselines();
  for (const baseline of baselines) {
    assert.ok(typeof baseline.capabilityId === "string");
    assert.ok(typeof baseline.entryModule === "string");
    assert.ok(typeof baseline.description === "string");
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("oapeflir baseline has correct description", () => {
  const baselines = listOrchestrationCapabilityBaselines();
  const oapeflir = baselines.find(b => b.capabilityId === "oapeflir");
  assert.ok(oapeflir !== undefined);
  assert.ok(oapeflir.description.includes("Observe-assess-plan"));
  assert.ok(oapeflir.baselineServices.includes("OapeflirLoopService"));
});

test("harness baseline has correct description", () => {
  const baselines = listOrchestrationCapabilityBaselines();
  const harness = baselines.find(b => b.capabilityId === "harness");
  assert.ok(harness !== undefined);
  assert.ok(harness.description.includes("ConstraintPack"));
  assert.ok(harness.baselineServices.includes("HarnessRuntimeService"));
});

test("planner baseline has correct services", () => {
  const baselines = listOrchestrationCapabilityBaselines();
  const planner = baselines.find(b => b.capabilityId === "planner");
  assert.ok(planner !== undefined);
  assert.ok(planner.baselineServices.includes("TaskDecompositionService"));
});

test("resolveOrchestrationCapabilityBaseline returns correct baseline", () => {
  const baseline = resolveOrchestrationCapabilityBaseline("oapeflir");
  assert.equal(baseline.capabilityId, "oapeflir");
  assert.equal(baseline.entryModule, "src/platform/orchestration/oapeflir/index.ts");
});

test("resolveOrchestrationCapabilityBaseline throws for unknown capability", () => {
  assert.throws(() => {
    resolveOrchestrationCapabilityBaseline("unknown" as any);
  }, /orchestration_capability.not_found/);
});

test("resolveOrchestrationCapabilityBaseline works for all capability IDs", () => {
  const baselines = listOrchestrationCapabilityBaselines();
  for (const baseline of baselines) {
    const resolved = resolveOrchestrationCapabilityBaseline(baseline.capabilityId);
    assert.equal(resolved.capabilityId, baseline.capabilityId);
  }
});