import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSdk } from "../../../src/sdk/harness-sdk/index.js";

test("HarnessSdk provides a stable facade over HarnessRuntimeService", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task_1",
    domainId: "legal",
    constraintPack: {
      policyIds: ["policy.audit"],
      approvalMode: "supervised",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["search", "compose"] },
      risk_policy: { maxRiskScore: 0.6, escalationThreshold: 0.4 },
      output_policy: { requiredEvidence: ["decision_log"], redactSensitiveData: true },
      budget: { maxSteps: 5, maxCost: 5, maxDurationMs: 60_000 },
    },
  });

  const runWithStep = sdk.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { prompt: "plan" },
    outputs: { plan: "ok" },
  });
  const decision = sdk.decide({ evaluatorScore: 0.9 });

  assert.ok(run.runId.startsWith("harness_run_"));
  assert.equal(runWithStep.steps.length, 1);
  assert.equal(decision.action, "accept");
  assert.deepEqual(sdk.assertInvariants(runWithStep).violations, []);
});
