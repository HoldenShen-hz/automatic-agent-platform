import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../src/platform/orchestration/harness/index.js";

function criticalPlan(title: string): string {
  return `oapeflir://plan ${JSON.stringify([
    {
      nodeId: "review-risk",
      nodeType: "evaluator",
      inputRefs: [],
      outputSchemaRef: "schema:review-risk",
      riskClass: "critical",
      budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 30_000,
    },
    {
      nodeId: "execute-change",
      nodeType: "tool",
      inputRefs: ["review-risk"],
      outputSchemaRef: "schema:execute-change",
      riskClass: "critical",
      budgetIntent: { amount: 0.02, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: true, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 30_000,
      title,
    },
  ])}`;
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

test("E2E Critical Workflows: canonical deployment path completes without WorkflowState/currentStepIndex", async () => {
  const harness = createE2EHarness("aa-e2e-critical-complete-");
  try {
    const service = new HarnessRuntimeService();
    const run = service.runLoop({
      taskId: "task-critical-workflow-001",
      domainId: "operations",
      constraintPack: constraintPack(),
      plannerOutput: { planId: "plan-critical-001", summary: "Deploy production change" },
      generatorOutput: { artifact: "deploy.diff", toolCalls: [] },
      evaluatorOutput: { verdict: "pass", feedback: "Approved deployment package" },
      evaluatorScore: 0.9,
      producedEvidenceRefs: [],
    });

    assert.equal(run.status, "completed");
    assert.ok(run.timeline.length > 0);
  } finally {
    harness.cleanup();
  }
});

test("E2E Critical Workflows: canonical failure path stays on task/workflow terminal projections", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-critical-fail-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "Critical database migration workflow",
        request: `oapeflir://plan ${JSON.stringify([
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
        ])}`,
        stepOutputOverrides: {
          step_first: { first: "first step completed" },
        },
        stepFailurePlans: {
          step_failing: ["step.failed", "critical workflow failure regression"],
        },
      });

      assert.equal(result.snapshot.task?.status, "failed");
      assert.equal(result.snapshot.workflow?.status, "failed");
    } finally {
      harness.cleanup();
    }
  });

  await guard();
});
