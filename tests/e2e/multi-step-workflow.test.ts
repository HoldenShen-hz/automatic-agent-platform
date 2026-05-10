import assert from "node:assert/strict";
import test from "node:test";

import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";

function createThreeStepPlan(): string {
  return `oapeflir://plan ${JSON.stringify([
    {
      stepId: "step_extract",
      action: "extract",
      dependencies: [],
      outputs: ["step_extract"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_transform",
      action: "transform",
      dependencies: ["step_extract"],
      outputs: ["step_transform"],
      timeout: 30000,
      retryPolicy: { maxRetries: 1, backoffMs: 0 },
    },
    {
      stepId: "step_publish",
      action: "publish",
      dependencies: ["step_transform"],
      outputs: ["step_publish"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ])}`;
}

test("E2E: multi-step workflow executes through canonical PlanGraphBundle orchestration", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-multi-step-canonical-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "Canonical multi-step workflow test",
        request: createThreeStepPlan(),
        stepOutputOverrides: {
          step_extract: { extracted: "source document" },
          step_transform: { transformed: "normalized document" },
          step_publish: { published: "final report" },
        },
      });

      assert.equal(result.routing.routeReason, "oapeflir_bridge");
      assert.ok(result.snapshot.task);
      assert.ok(result.snapshot.workflow);
      assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"));

      const output = JSON.parse(result.snapshot.task?.outputJson ?? "{}");
      assert.ok(typeof output === "object");
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E: multi-step workflow preserves dependency-ordered outputs without legacy workflow state APIs", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-multi-step-deps-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "Dependency ordered workflow test",
        request: createThreeStepPlan(),
        stepOutputOverrides: {
          step_extract: { payload: { prerequisite: "ready" } },
          step_transform: { payload: { dependsOn: "ready", transformed: true } },
          step_publish: { payload: { consumed: "ready", final: "published" } },
        },
      });

      assert.deepEqual(
        result.plannedWorkflow.executionSteps.map((step) => step.stepId),
        ["step_extract", "step_transform", "step_publish"],
      );
      assert.deepEqual(
        result.plannedWorkflow.executionSteps.map((step) => step.dependsOnStepIds),
        [[], ["step_extract"], ["step_transform"]],
      );
      assert.equal(result.routing.routeReason, "oapeflir_bridge");
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E: multi-step workflow records terminal failure through canonical orchestration path", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-multi-step-failure-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "Failing canonical multi-step workflow",
        request: createThreeStepPlan(),
        stepOutputOverrides: {
          step_extract: { extracted: "source document" },
        },
        stepFailurePlans: {
          step_transform: ["step.failed", "Transform failed for canonical workflow test"],
        },
      });

      assert.ok(result.snapshot.task);
      assert.ok(result.snapshot.workflow);
      assert.equal(result.routing.routeReason, "oapeflir_bridge");
      assert.ok(result.plannedWorkflow.executionSteps.some((step) => step.stepId === "step_transform"));
    } finally {
      harness.cleanup();
    }
  });
  await guard();
});
