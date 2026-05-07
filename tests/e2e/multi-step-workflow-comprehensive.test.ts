import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../src/platform/orchestration/harness/index.js";

function planRequest(nodes: readonly Record<string, unknown>[]): string {
  return `oapeflir://plan ${JSON.stringify(nodes)}`;
}

function constraintPack(): ConstraintPack {
  return {
    policyIds: ["policy.e2e.default"],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["read", "write", "bash"] },
    risk_policy: {
      maxRiskScore: 80,
      escalationThreshold: 60,
    },
    output_policy: {
      requiredEvidence: [],
      redactSensitiveData: false,
    },
    sandboxRequirement: {
      sandboxMode: "none",
      timeoutMs: 60_000,
    },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60_000,
    },
    budget: {
      maxSteps: 9,
      maxCost: 10,
      maxDurationMs: 60_000,
    },
  };
}

test("E2E Multi-Step Workflow: canonical PlanGraph completes end-to-end", async () => {
  const harness = createE2EHarness("aa-e2e-canonical-five-step-");
  try {
    const service = new HarnessRuntimeService();
    const run = service.runLoop({
      taskId: "task-canonical-multi-step-001",
      domainId: "coding",
      constraintPack: constraintPack(),
      plannerOutput: { planId: "plan-001", summary: "Canonical multi-step workflow" },
      generatorOutput: { artifact: "workflow.diff", toolCalls: [] },
      evaluatorOutput: { verdict: "pass", feedback: "Looks good" },
      evaluatorScore: 0.91,
      producedEvidenceRefs: [],
    });

    assert.equal(run.status, "completed");
    assert.ok(run.completedAt);
    assert.ok(run.timeline.length > 0);
  } finally {
    harness.cleanup();
  }
});

test("E2E Multi-Step Workflow: canonical failure path records terminal failure without WorkflowState CRUD", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-canonical-failure-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "Canonical failing workflow",
        request: planRequest([
          {
            nodeId: "step_first",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:first.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30_000,
          },
          {
            nodeId: "step_failing",
            nodeType: "tool",
            inputRefs: ["step_first"],
            outputSchemaRef: "schema:failing.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30_000,
          },
          {
            nodeId: "step_last",
            nodeType: "tool",
            inputRefs: ["step_failing"],
            outputSchemaRef: "schema:last.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30_000,
          },
        ]),
        stepOutputOverrides: {
          step_first: { first: "first step completed" },
        },
        stepFailurePlans: {
          step_failing: ["step.failed", "Step failed as planned for test"],
        },
      });

      assert.equal(result.snapshot.task?.status, "failed");
      assert.equal(result.snapshot.workflow?.status, "failed");
      const output = JSON.parse(result.snapshot.task?.outputJson ?? "{}") as Record<string, unknown>;
      assert.ok(Array.isArray(output.failedStepIds));
      assert.ok(output.error);
    } finally {
      harness.cleanup();
    }
  });

  await guard();
});
