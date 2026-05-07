import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../src/platform/orchestration/harness/index.js";

function buildPlan(nodes: readonly Record<string, unknown>[]): string {
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

test("E2E Multi-Step Task Execution: canonical task execution completes without legacy WorkflowState", async () => {
  const harness = createE2EHarness("aa-e2e-node-output-");
  try {
    const service = new HarnessRuntimeService();
    let run = service.createRun({
      taskId: "task-canonical-task-execution-001",
      domainId: "coding",
      constraintPack: constraintPack(),
    });
    run = service.transitionRunStatus(run, "admitted", "harness.admitted");
    run = service.transitionRunStatus(run, "ready", "harness.ready");
    run = service.transitionRunStatus(run, "running", "harness.running");
    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: { planId: "plan-001" },
    });
    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan-001" },
      outputs: { artifact: "workflow.diff" },
    });
    run = service.transitionRunStatus(run, "completed", "harness.completed");

    assert.equal(run.status, "completed");
    assert.equal(run.steps.length, 2);
  } finally {
    harness.cleanup();
  }
});

test("E2E Multi-Step Task Execution: canonical route is the oapeflir bridge path", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-plan-graph-route-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "Canonical route test",
        request: buildPlan([
          {
            nodeId: "step_extract",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:extract.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 15_000,
          },
        ]),
      });

      assert.equal(result.routing.routeReason, "oapeflir_bridge");
      assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"));
    } finally {
      harness.cleanup();
    }
  });

  await guard();
});

test("E2E Multi-Step Task Execution: canonical failing node leaves task in failed terminal state", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-terminal-failure-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "Terminal failure test",
        request: buildPlan([
          {
            nodeId: "precheck",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:precheck",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 15_000,
          },
          {
            nodeId: "step_failing",
            nodeType: "tool",
            inputRefs: ["precheck"],
            outputSchemaRef: "schema:failing.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 15_000,
          },
        ]),
        stepOutputOverrides: {
          precheck: { allowed: true },
        },
        stepFailurePlans: {
          step_failing: ["step.failed", "terminal failure regression"],
        },
      });

      assert.equal(result.snapshot.task?.status, "failed");
      assert.equal(result.snapshot.workflow?.status, "failed");
      const output = JSON.parse(result.snapshot.task?.outputJson ?? "{}") as Record<string, unknown>;
      assert.ok(Array.isArray(output.failedStepIds));
    } finally {
      harness.cleanup();
    }
  });

  await guard();
});
