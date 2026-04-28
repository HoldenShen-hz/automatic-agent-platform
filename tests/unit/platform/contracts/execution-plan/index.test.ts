/**
 * @deprecated This test suite validates the deprecated ExecutionPlan contract.
 * Per R6-25, these tests verify the legacy contract is properly blocked.
 * New tests should use PlanGraphBundle from executable-contracts instead.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionPlan,
  type ExecutionPlanStep,
} from "../../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

/**
 * @deprecated ExecutionPlanStep is deprecated per §4.4. Use PlanNode from executable-contracts instead.
 */
test("ExecutionPlanStep remains available as a compatibility type", () => {
  const step: ExecutionPlanStep = {
    stepId: "legacy-step-1",
    title: "Legacy step",
    actionRef: "legacy.action",
    dependsOn: [],
    requiresApproval: false,
  };

  assert.equal(step.stepId, "legacy-step-1");
});

test("createExecutionPlan fails fast because ExecutionPlan is no longer canonical", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task-1",
        tenantId: "tenant-1",
        version: 1,
        steps: [
          {
            stepId: "step-1",
            title: "Legacy step",
            actionRef: "legacy.action",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "execution_plan.legacy_contract_forbidden",
  );
});
