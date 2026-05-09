import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  type ConstraintPack,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["read"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
    output_policy: { requiredEvidence: [], redactSensitiveData: true },
    sandboxRequirement: {
      sandboxMode: "network_isolated",
      timeoutMs: 30_000,
    },
    budgetEnvelope: {
      maxSteps: 4,
      maxCost: 10,
      maxDurationMs: 60_000,
    },
    budget: {
      maxSteps: 4,
      maxCost: 10,
      maxDurationMs: 60_000,
    },
  };
}

test("HarnessRuntimeService appendStep records a completion time after start even without explicit latency", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-r23-49",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const updated = service.appendStep(run, {
    role: "generator",
    nodeId: "node-r23-49",
    inputs: { prompt: "generate patch" },
    outputs: { artifact: "patch.diff" },
  });

  assert.ok(updated.steps[0] != null);
  assert.notEqual(updated.steps[0]!.startedAt, updated.steps[0]!.completedAt);
  assert.ok(Date.parse(updated.steps[0]!.completedAt) > Date.parse(updated.steps[0]!.startedAt));
});
