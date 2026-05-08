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
  return {
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
    budgetEnvelope: {
      maxSteps: 12,
      maxCost: 100,
      maxDurationMs: 60_000,
      maxModelTokens: 4_096,
      maxContextTokens: 8_192,
      maxOutputTokens: 2_048,
    },
    budget: {
      maxSteps: 12,
      maxCost: 100,
      maxDurationMs: 60_000,
    },
    ...overrides,
  };
}

test("normalizeConstraintPack keeps all six budget dimensions available", () => {
  const normalized = normalizeConstraintPack(createConstraintPack());

  assert.equal(normalized.budget?.max_model_tokens, 4_096);
  assert.equal(normalized.budget?.max_context_tokens, 8_192);
  assert.equal(normalized.budget?.max_output_tokens, 2_048);
  assert.equal(normalized.budgetEnvelope?.maxModelTokens, 4_096);
  assert.equal(normalized.budgetEnvelope?.maxContextTokens, 8_192);
  assert.equal(normalized.budgetEnvelope?.maxOutputTokens, 2_048);
  assert.deepEqual(getConstraintRiskPolicy(normalized), { maxRiskScore: 0.8, escalationThreshold: 0.6 });
  assert.deepEqual(getConstraintOutputPolicy(normalized), { requiredEvidence: [], redactSensitiveData: true });
});

test("toCanonicalHarnessRun backfills trace, ownership, and audit defaults", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-canonical-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const canonical = toCanonicalHarnessRun(run);

  assert.equal(canonical.traceId, `trace:${run.harnessRunId}`);
  assert.equal(canonical.riskLevel, "medium");
  assert.deepEqual(canonical.ownership, { ownerId: "tenant:local", ownerType: "harness" });
  assert.deepEqual(canonical.auditRefs, []);
});

test("HarnessRuntimeService.runLoop uses loop services across replans", () => {
  const service = new HarnessRuntimeService();
  const plannerInputs: Array<{ iteration: number; previousPlannerOutput: Readonly<Record<string, unknown>> | null }> = [];

  const run = service.runLoop({
    taskId: "task-loop-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    requestedTools: ["read", "write"],
    loopServices: {
      plan(input) {
        plannerInputs.push({ iteration: input.iteration, previousPlannerOutput: input.previousPlannerOutput });
        return { planId: `plan-${input.iteration}`, output: `plan:${input.iteration}` };
      },
      generate(input) {
        return { artifact: `artifact-${input.iteration}`, output: `artifact:${input.iteration}`, planId: input.plannerOutput.planId };
      },
      evaluate(input) {
        return input.iteration === 1
          ? { score: 0.2, verdict: "replan", artifact: input.generatorOutput.artifact }
          : { score: 0.95, verdict: "accept", artifact: input.generatorOutput.artifact };
      },
    },
  });

  assert.equal(run.status, "completed");
  assert.equal(plannerInputs.length, 2);
  assert.equal(plannerInputs[0]?.previousPlannerOutput, null);
  assert.equal(plannerInputs[1]?.previousPlannerOutput?.planId, "plan-1");
});

test("HarnessRuntimeService.decide honors deterministic abort and appendStep preserves step metadata", () => {
  const service = new HarnessRuntimeService();

  const decision = service.decide({
    evaluatorScore: 0.99,
    budgetExhausted: true,
  });
  assert.equal(decision.action, "abort");
  assert.ok(decision.reasonCodes.includes("harness.budget_exhausted"));

  const run = service.createRun({
    taskId: "task-step-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const updated = service.appendStep(run, {
    role: "generator",
    nodeId: "node-1",
    inputs: { prompt: "hello" },
    outputs: { artifact: "patch.diff" },
    nodeRunId: "node_run_1",
    rationale: "Need a patch",
    evidenceRefs: ["evidence-1"],
    toolCalls: [{ tool: "read" }],
    latency: 12,
    cost: 0.34,
    error: "transient_tool_timeout",
    nextAction: "evaluate",
  });

  assert.deepEqual(updated.steps[0]?.nodeRunRefs, ["node_run_1"]);
  assert.deepEqual(updated.steps[0]?.toolCalls, [{ tool: "read" }]);
  assert.equal(updated.steps[0]?.latency, 12);
  assert.equal(updated.steps[0]?.error, "transient_tool_timeout");
  assert.equal(updated.steps[0]?.nextAction, "evaluate");
});
