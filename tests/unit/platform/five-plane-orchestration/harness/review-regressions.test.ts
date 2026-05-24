import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  toCanonicalHarnessRun,
  type ConstraintPack,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
    output_policy: { requiredEvidence: [], redactSensitiveData: true },
    sandboxRequirement: {
      sandboxMode: "network_isolated",
      timeoutMs: 30_000,
      allowedHosts: ["api.example.com"],
    },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["reviewer"],
      escalationTimeoutMs: 300_000,
    },
    budgetEnvelope: {
      maxSteps: 12,
      maxCost: 100,
      maxDurationMs: 60_000,
      maxModelTokens: 4_096,
      maxContextTokens: 8_192,
      maxOutputTokens: 2_048,
    },
    ...overrides,
  });
}

test("normalizeConstraintPack preserves budget and policy dimensions", () => {
  const normalized = createConstraintPack();

  assert.equal(normalized.budgetEnvelope?.maxModelTokens, 4_096);
  assert.equal(normalized.budget?.max_model_tokens, 4_096);
  assert.deepEqual(getConstraintRiskPolicy(normalized), { maxRiskScore: 0.8, escalationThreshold: 0.6 });
  assert.deepEqual(getConstraintOutputPolicy(normalized), { requiredEvidence: [], redactSensitiveData: true });
});

test("HarnessRuntimeService review loop carries previous planner output", () => {
  const service = new HarnessRuntimeService();
  const previousPlans: Array<Readonly<Record<string, unknown>> | null> = [];

  const run = service.runLoop({
    taskId: "task-review-loop",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    requestedTools: ["read", "write"],
    loopServices: {
      plan(input) {
        previousPlans.push(input.previousPlannerOutput);
        return { planId: `plan-${input.iteration}`, output: `plan:${input.iteration}` };
      },
      generate(input) {
        return { artifact: `artifact-${input.iteration}`, output: input.plannerOutput.planId };
      },
      evaluate(input) {
        return input.iteration === 1
          ? { score: 0.2, verdict: "replan" }
          : { score: 0.95, verdict: "accept" };
      },
    },
  });

  assert.equal(run.status, "completed");
  assert.equal(previousPlans[0], null);
  assert.equal(previousPlans[1]?.planId, "plan-1");
});

test("toCanonicalHarnessRun preserves runtime identifiers", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-review-canonical",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const canonical = toCanonicalHarnessRun(run);

  assert.equal(canonical.harnessRunId, run.harnessRunId);
  assert.equal(canonical.constraintPackRef, run.constraintPackRef);
});
