import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService } from "../../../../../src/platform/orchestration/harness/index.js";

test("HarnessRuntimeService.decide emits canonical decision linkage alongside local action projection", () => {
  const runtime = new HarnessRuntimeService();
  const decision = runtime.decide({
    evaluatorScore: 0.91,
    harnessRunId: "hrun-demo",
    nodeRunId: "node-demo",
    evidenceRefs: ["artifact-1"],
    deciderRef: "unit-test",
  });

  assert.equal(decision.decisionId, decision.harnessDecisionId);
  assert.equal(decision.decisionKind, "approve");
  assert.equal(decision.decision, "accept");
  assert.equal(decision.deciderType, "evaluator");
  assert.equal(decision.deciderRef, "unit-test");
  assert.equal(decision.reasonCode, "harness.accepted");
  assert.ok(decision.decisionInputBundleId?.startsWith("dib_"));
  assert.deepEqual(decision.reasonCodes, ["harness.accepted"]);
});

test("HarnessRuntimeService.decide maps escalation and abort paths to canonical decision kinds", () => {
  const runtime = new HarnessRuntimeService();
  const escalate = runtime.decide({
    evaluatorScore: 0.8,
    requiresHuman: true,
    harnessRunId: "hrun-escalate",
  });
  const abort = runtime.decide({
    evaluatorScore: 0.8,
    maxIterationsReached: true,
    harnessRunId: "hrun-abort",
  });

  assert.equal(escalate.action, "escalate_to_human");
  assert.equal(escalate.decisionKind, "takeover");
  assert.equal(escalate.decision, "escalate");
  assert.equal(escalate.deciderType, "policy");
  assert.equal(abort.action, "abort");
  assert.equal(abort.decisionKind, "abort");
  assert.equal(abort.decision, "abort");
  assert.equal(abort.deciderType, "system");
});
