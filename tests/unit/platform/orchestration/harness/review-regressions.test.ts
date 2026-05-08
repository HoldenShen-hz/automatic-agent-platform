import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  normalizeConstraintPack,
  toCanonicalHarnessRun,
  type ConstraintPack,
} from "../../../../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "semi_auto",
    tool_policy: {
      allowedTools: ["read", "write"],
    },
    risk_policy: {
      maxRiskScore: 0.8,
      escalationThreshold: 0.6,
    },
    output_policy: {
      requiredEvidence: [],
      redactSensitiveData: true,
    },
    sandboxRequirement: {
      sandboxMode: "network_isolated",
      timeoutMs: 30_000,
      allowedHosts: ["api.example.com"],
    },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60_000,
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

test("toCanonicalHarnessRun backfills trace, risk, ownership, and audit refs", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-canonical-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const canonical = toCanonicalHarnessRun(run);

  assert.equal(canonical.tenantId, "tenant:local");
  assert.equal(canonical.traceId, `trace:${run.harnessRunId}`);
  assert.equal(canonical.riskLevel, "medium");
  assert.deepEqual(canonical.ownership, { ownerId: "tenant:local", ownerType: "harness" });
  assert.deepEqual(canonical.auditRefs, []);
  assert.deepEqual(canonical.auditTrail.auditRefs, []);
});

test("HarnessRuntimeService.decide keeps deterministic failures ahead of high evaluator scores", () => {
  const service = new HarnessRuntimeService();

  const sideEffectAbort = service.decide({
    evaluatorScore: 0.98,
    sideEffectMayCommit: false,
  });
  const budgetAbort = service.decide({
    evaluatorScore: 0.98,
    budgetExhausted: true,
  });
  const hitlEscalation = service.decide({
    evaluatorScore: 0.98,
    hitlPending: true,
  });

  assert.equal(sideEffectAbort.action, "abort");
  assert.ok(sideEffectAbort.reasonCodes.includes("harness.side_effect_cannot_commit"));
  assert.equal(budgetAbort.action, "abort");
  assert.ok(budgetAbort.reasonCodes.includes("harness.budget_exhausted"));
  assert.equal(hitlEscalation.action, "escalate_to_human");
  assert.ok(hitlEscalation.reasonCodes.includes("harness.hitl_pending"));
});

test("HarnessRuntimeService.runLoop uses dynamic loop services and threads previous planner output across replans", () => {
  const service = new HarnessRuntimeService();
  const plannerInputs: Array<{ iteration: number; previousPlannerOutput: Readonly<Record<string, unknown>> | null }> = [];

  const run = service.runLoop({
    taskId: "task-replan-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    loopServices: {
      plan(input) {
        plannerInputs.push({
          iteration: input.iteration,
          previousPlannerOutput: input.previousPlannerOutput,
        });
        return {
          planId: `plan-${input.iteration}`,
          output: `plan:${input.iteration}`,
        };
      },
      generate(input) {
        return {
          artifact: `artifact-${input.iteration}`,
          output: `artifact:${input.iteration}`,
          plannerPlanId: input.plannerOutput.planId,
        };
      },
      evaluate(input) {
        return input.iteration === 1
          ? { score: 0.2, verdict: "replan", previousArtifact: input.generatorOutput.artifact }
          : { score: 0.95, verdict: "accept", previousArtifact: input.generatorOutput.artifact };
      },
    },
  });

  assert.equal(run.status, "completed");
  assert.equal(plannerInputs.length, 2);
  assert.equal(plannerInputs[0]?.previousPlannerOutput, null);
  assert.equal(plannerInputs[1]?.previousPlannerOutput?.planId, "plan-1");
});

test("HarnessRuntimeService.runLoop records measured step latency and sandbox bindings on the main path", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-sandbox-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    requestedTools: ["read", "write"],
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "artifact-1" },
    evaluatorOutput: { score: 0.92, verdict: "accept" },
    producedEvidenceRefs: [],
  });

  assert.ok(run.steps.some((step) => typeof step.latency === "number" && step.latency >= 1));
  assert.equal(run.toolbelt?.sandboxLayer.defaultLayer, "network_isolated");
  assert.deepEqual(
    run.toolbelt?.sandboxLayer.bindings.map((binding) => binding.toolName),
    ["read", "write"],
  );
  assert.deepEqual(
    run.sandboxLayer?.bindings.map((binding) => binding.toolName),
    ["read", "write"],
  );
});

test("HarnessRuntimeService.appendStep preserves node, evidence, tool, and next-action metadata", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-step-metadata-1",
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
  assert.equal(updated.steps[0]?.rationale, "Need a patch");
  assert.deepEqual(updated.steps[0]?.evidenceRefs, ["evidence-1"]);
  assert.deepEqual(updated.steps[0]?.toolCalls, [{ tool: "read" }]);
  assert.equal(updated.steps[0]?.latency, 12);
  assert.equal(updated.steps[0]?.cost, 0.34);
  assert.equal(updated.steps[0]?.error, "transient_tool_timeout");
  assert.equal(updated.steps[0]?.nextAction, "evaluate");
});
