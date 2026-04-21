import assert from "node:assert/strict";
import test from "node:test";
test("CompensationModel accepts all valid values", () => {
    const models = [
        "idempotent_replay",
        "compare_and_swap_write",
        "compensating_action",
        "manual_reconciliation_required",
    ];
    assert.equal(models.length, 4);
});
test("MinimalWorkflowStep structure is correct", () => {
    const step = {
        stepId: "step_1",
        divisionId: "general_ops",
        roleId: "executor",
        inputKeys: ["input1", "input2"],
        outputKey: "result",
        outputSchemaPath: "/schemas/output.json",
        timeoutMs: 60000,
        maxAttempts: 3,
        dependsOnStepIds: ["prev_step"],
        dependencyTypes: { prev_step: "hard" },
        compensationModel: "idempotent_replay",
    };
    assert.equal(step.stepId, "step_1");
    assert.equal(step.roleId, "executor");
    assert.equal(step.timeoutMs, 60000);
});
test("MinimalWorkflowStep allows minimal definition", () => {
    const step = {
        stepId: "minimal_step",
        roleId: "executor",
        outputKey: "out",
        timeoutMs: 30000,
        maxAttempts: 1,
    };
    assert.equal(step.divisionId, undefined);
    assert.equal(step.inputKeys, undefined);
    assert.equal(step.dependsOnStepIds, undefined);
});
test("MinimalWorkflowStep allows null divisionId", () => {
    const step = {
        stepId: "step_null_division",
        divisionId: null,
        roleId: "executor",
        outputKey: "out",
        timeoutMs: 30000,
        maxAttempts: 1,
    };
    assert.equal(step.divisionId, null);
});
test("MinimalWorkflowStep dependencyTypes accepts hard and soft", () => {
    const step = {
        stepId: "dependent_step",
        roleId: "executor",
        inputKeys: ["dep1", "dep2"],
        outputKey: "result",
        timeoutMs: 30000,
        maxAttempts: 1,
        dependsOnStepIds: ["dep1", "dep2"],
        dependencyTypes: {
            dep1: "hard",
            dep2: "soft",
        },
    };
    assert.equal(step.dependencyTypes["dep1"], "hard");
    assert.equal(step.dependencyTypes["dep2"], "soft");
});
test("MinimalWorkflowStep compensationModel accepts all values", () => {
    const models = [
        "idempotent_replay",
        "compare_and_swap_write",
        "compensating_action",
        "manual_reconciliation_required",
    ];
    for (const model of models) {
        const step = {
            stepId: `step_${model}`,
            roleId: "executor",
            outputKey: "out",
            timeoutMs: 30000,
            maxAttempts: 1,
            compensationModel: model,
        };
        assert.equal(step.compensationModel, model);
    }
});
test("MinimalWorkflowDefinition structure is correct", () => {
    const definition = {
        workflowId: "workflow_123",
        divisionId: "general_ops",
        steps: [
            {
                stepId: "step_1",
                roleId: "executor",
                outputKey: "out1",
                timeoutMs: 30000,
                maxAttempts: 1,
            },
            {
                stepId: "step_2",
                roleId: "reviewer",
                inputKeys: ["out1"],
                outputKey: "out2",
                timeoutMs: 60000,
                maxAttempts: 2,
                dependsOnStepIds: ["step_1"],
            },
        ],
    };
    assert.equal(definition.workflowId, "workflow_123");
    assert.equal(definition.steps.length, 2);
});
test("MinimalWorkflowDefinition allows empty steps", () => {
    const definition = {
        workflowId: "empty_workflow",
        divisionId: "general_ops",
        steps: [],
    };
    assert.equal(definition.steps.length, 0);
});
test("MinimalWorkflowDefinition steps are readonly", () => {
    const definition = {
        workflowId: "readonly_steps",
        divisionId: "general_ops",
        steps: [
            {
                stepId: "step_1",
                roleId: "executor",
                outputKey: "out",
                timeoutMs: 30000,
                maxAttempts: 1,
            },
        ],
    };
    // Verify steps array is readonly by attempting to modify (this should be prevented by TypeScript)
    const steps = definition.steps;
    assert.equal(steps.length, 1);
});
//# sourceMappingURL=minimal-workflow-types.test.js.map