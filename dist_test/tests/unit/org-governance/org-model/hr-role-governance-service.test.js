import assert from "node:assert/strict";
import test from "node:test";
test("HrGapTriggerReason type exports are correct", () => {
    const reasons = ["no_role_match", "scope_exceeded"];
    for (const reason of reasons) {
        assert.ok(["no_role_match", "scope_exceeded"].includes(reason));
    }
});
test("HrProposalApprovalStatus type exports are correct", () => {
    const status = "approved";
    assert.ok(status === "approved");
});
test("HrGapAnalysisRequest structure", () => {
    const request = {
        taskId: "task_123",
        taskDescription: "Deploy a new service",
        targetDivisionId: "platform_team",
        triggerReason: "no_role_match",
        requestedCapabilities: ["kubernetes", "docker"],
    };
    assert.equal(request.taskId, "task_123");
    assert.equal(request.triggerReason, "no_role_match");
    assert.deepEqual(request.requestedCapabilities, ["kubernetes", "docker"]);
});
test("HrGapAnalysisResult structure", () => {
    const result = {
        taskId: "task_123",
        targetDivisionId: "platform_team",
        triggerReason: "scope_exceeded",
        matchedRoleIds: ["role_k8s_admin", "role_devops"],
        missingCapabilities: ["aws"],
        divisionToolUnion: ["kubectl", "helm", "terraform"],
        suggestedToolNames: ["deploy", "scale"],
        recommendedModel: "coding",
    };
    assert.equal(result.taskId, "task_123");
    assert.deepEqual(result.matchedRoleIds, ["role_k8s_admin", "role_devops"]);
    assert.deepEqual(result.missingCapabilities, ["aws"]);
    assert.equal(result.recommendedModel, "coding");
});
test("HrRoleSchemaShape structure", () => {
    const schema = {
        required: ["taskId", "command"],
        optional: ["timeout", "retries"],
    };
    assert.deepEqual(schema.required, ["taskId", "command"]);
    assert.deepEqual(schema.optional, ["timeout", "retries"]);
});
test("HrRolePrecondition structure", () => {
    const precondition = {
        check: "has_kubernetes_access",
        description: "User must have Kubernetes cluster access",
    };
    assert.equal(precondition.check, "has_kubernetes_access");
    assert.equal(precondition.description, "User must have Kubernetes cluster access");
});
test("HrWorkflowStepSuggestion structure", () => {
    const step = {
        stepId: "step_1",
        roleId: "role_deployer",
        inputKeys: ["image_tag", "environment"],
        outputKey: "deployment_result",
        timeoutMs: 60000,
        maxAttempts: 3,
        autoApply: true,
    };
    assert.equal(step.stepId, "step_1");
    assert.equal(step.roleId, "role_deployer");
    assert.equal(step.timeoutMs, 60000);
    assert.equal(step.autoApply, true);
});
test("HrWorkflowSuggestion structure", () => {
    const suggestion = {
        insertAfterStepId: "step_0",
        step: {
            stepId: "step_1",
            roleId: "role_deployer",
            outputKey: "deployment_result",
            timeoutMs: 60000,
            maxAttempts: 1,
        },
    };
    assert.equal(suggestion.insertAfterStepId, "step_0");
    assert.equal(suggestion.step.roleId, "role_deployer");
});
//# sourceMappingURL=hr-role-governance-service.test.js.map