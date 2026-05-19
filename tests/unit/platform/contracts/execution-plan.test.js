import assert from "node:assert/strict";
import test from "node:test";
import { createExecutionPlan } from "../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("execution-plan contract remains as compatibility shell and rejects legacy creation", () => {
    assert.throws(() => createExecutionPlan({
        taskId: "task_123",
        tenantId: "tenant_abc",
        version: 1,
        steps: [
            {
                stepId: "step_1",
                title: "First step",
                actionRef: "action_one",
                dependsOn: [],
                requiresApproval: false,
            },
        ],
    }), (error) => error instanceof ValidationError && error.code === "execution_plan.legacy_contract_forbidden");
});
//# sourceMappingURL=execution-plan.test.js.map