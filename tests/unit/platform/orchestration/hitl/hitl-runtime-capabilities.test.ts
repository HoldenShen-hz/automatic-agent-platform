import assert from "node:assert/strict";
import test from "node:test";

import {
  HitlForceTerminateService,
  HitlOverrideService,
  HitlPatchService,
} from "../../../../../src/platform/orchestration/hitl/index.js";

test("HitlPatchService supports modify-and-approve flow", () => {
  const service = new HitlPatchService();
  const request = service.requestPatch({
    target: { targetType: "task", targetId: "task-1" },
    patches: [{ path: "/title", operation: "replace", value: "patched" }],
    reason: "operator correction",
    requestedBy: "operator-1",
    riskLevel: "medium",
  });

  const result = service.approvePatch(request.requestId, "operator-2", () => true);
  assert.equal(result.approved, true);
  assert.equal(result.appliedPatches.length, 1);
});

test("HitlOverrideService supports override-decision flow", () => {
  const service = new HitlOverrideService();
  const request = service.requestOverride({
    target: { targetType: "execution", targetId: "exec-1" },
    overrideReason: "human override after context review",
    requestedBy: "operator-1",
    riskLevel: "high",
    timeoutPolicy: "reject",
  });

  const result = service.approveOverride(request.requestId, "operator-2", () => ({ decision: "overridden" }));
  assert.equal(result.approved, true);
  assert.equal(result.executed, true);
  assert.equal(result.effect.decision, "overridden");
});

test("HitlForceTerminateService supports force-terminate flow", () => {
  const service = new HitlForceTerminateService();
  const request = service.requestForceTerminate({
    taskId: "task-2",
    executionId: "exec-2",
    requestedBy: "operator-1",
    reason: "irreversible impact containment",
    riskLevel: "critical",
  });

  const result = service.approveForceTerminate(request.requestId, "operator-2", () => true);
  assert.equal(result.terminated, true);
  assert.ok(result.terminatedAt);
});
