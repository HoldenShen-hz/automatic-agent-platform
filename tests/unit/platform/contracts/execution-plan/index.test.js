/**
 * Unit Tests: Execution Plan Contract (DEPRECATED)
 *
 * @deprecated These tests validate the deprecated ExecutionPlan contract.
 * ExecutionPlan was deprecated in v4.3 per §4.4 - use PlanGraphBundle instead.
 * These tests verify the deprecation guard works correctly.
 * New tests should use PlanGraphBundle from executable-contracts.
 *
 * Per R6-25: The legacy contract tests are intentionally minimal and only
 * verify that the deprecation guard throws correctly. The actual validation
 * logic has been removed - the contract is fully blocked.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createExecutionPlan, } from "../../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
/**
 * @deprecated ExecutionPlanStep is deprecated per §4.4. Use PlanNode from executable-contracts instead.
 * This type is retained for legacy adapter compatibility only.
 */
test("ExecutionPlanStep remains available as a compatibility type", () => {
    const step = {
        stepId: "legacy-step-1",
        title: "Legacy step",
        actionRef: "legacy.action",
        dependsOn: [],
        requiresApproval: false,
    };
    assert.equal(step.stepId, "legacy-step-1");
});
/**
 * @deprecated Per R6-25: createExecutionPlan is blocked - ExecutionPlan is no longer canonical.
 * Use PlanGraphBundle from executable-contracts instead.
 */
test("createExecutionPlan fails fast because ExecutionPlan is no longer canonical", () => {
    assert.throws(() => createExecutionPlan({
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
    }), (error) => error instanceof ValidationError && error.code === "execution_plan.legacy_contract_forbidden");
});
//# sourceMappingURL=index.test.js.map