import assert from "node:assert/strict";
import test from "node:test";

import { createExecutionPlan } from "../../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("legacy execution-plan factory is disabled in favor of PlanGraphBundle", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task-123",
        tenantId: "tenant-abc",
        version: 1,
        steps: [
          {
            stepId: "step-1",
            title: "Legacy plan",
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
