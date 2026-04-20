import assert from "node:assert/strict";
import test from "node:test";

import { createExecutionPlan } from "../../../../../src/platform/contracts/execution-plan/index.js";

test("createExecutionPlan preserves ordered steps and approval flags", () => {
  const plan = createExecutionPlan({
    taskId: "task-1",
    tenantId: "tenant-1",
    version: 1,
    steps: [
      { stepId: "step-1", title: "Collect input", actionRef: "input.collect", dependsOn: [], requiresApproval: false },
      { stepId: "step-2", title: "Deploy change", actionRef: "deploy.prod", dependsOn: ["step-1"], requiresApproval: true },
    ],
  });

  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[1]?.requiresApproval, true);
  assert.deepEqual(plan.steps[1]?.dependsOn, ["step-1"]);
});
