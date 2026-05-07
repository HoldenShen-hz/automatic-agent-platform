import assert from "node:assert/strict";
import test from "node:test";

import { SINGLE_AGENT_MINIMAL_WORKFLOW } from "../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js";
import { minimalWorkflowToPlanGraphBundle } from "../../../../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import { executeOapeflirRuntimePlan } from "../../../../../src/platform/five-plane-execution/oapeflir/runtime-plan-executor.js";
import { initHaCoordinatorForTests } from "../../../../helpers/ha-coordinator.ts";

test("executeOapeflirRuntimePlan consumes the provided PlanGraphBundle as the P3→P4 contract", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const planGraphBundle = minimalWorkflowToPlanGraphBundle(
      SINGLE_AGENT_MINIMAL_WORKFLOW,
      "harness_run:r4_26_runtime_executor",
    );

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(result.snapshot.task?.id, planGraphBundle.planGraphBundleId);
    const harnessRunCreatedEvent = result.snapshot.events.find(
      (event) => event.eventType === "platform.harness_run.status_changed",
    );
    assert.ok(harnessRunCreatedEvent);
    assert.equal(
      JSON.parse(harnessRunCreatedEvent?.payloadJson ?? "{}").harnessRunId,
      planGraphBundle.harnessRunId,
    );
    assert.equal(
      result.plannedWorkflow.workflow.steps[0]?.stepId,
      SINGLE_AGENT_MINIMAL_WORKFLOW.steps[0]?.stepId,
    );
  } finally {
    cleanup();
  }
});
