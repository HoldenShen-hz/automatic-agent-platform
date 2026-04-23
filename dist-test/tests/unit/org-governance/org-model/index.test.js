import assert from "node:assert/strict";
import test from "node:test";
test("HrGapTriggerReason type accepts valid values", () => {
    const reasons = ["no_role_match", "scope_exceeded"];
    assert.equal(reasons.length, 2);
});
test("HrProposalApprovalStatus type accepts valid values", () => {
    const statuses = ["approved"];
    assert.equal(statuses.length, 1);
    assert.equal(statuses[0], "approved");
});
test("HrGapAnalysisRequest structure is correct", () => {
    const request = {
        taskId: "task_1",
        taskDescription: "Write code",
        targetDivisionId: "engineering",
        triggerReason: "no_role_match",
        requestedCapabilities: ["coding", "testing"],
    };
    assert.equal(request.taskId, "task_1");
    assert.equal(request.triggerReason, "no_role_match");
});
test("HrGapAnalysisResult structure is correct", () => {
    const result = {
        taskId: "task_1",
        targetDivisionId: "engineering",
        triggerReason: "no_role_match",
        matchedRoleIds: ["coder", "reviewer"],
        missingCapabilities: ["security"],
        divisionToolUnion: ["coding", "testing", "security"],
        suggestedToolNames: ["read", "edit"],
        recommendedModel: "coding",
    };
    assert.equal(result.matchedRoleIds.length, 2);
    assert.equal(result.missingCapabilities.length, 1);
});
test("HrRoleSchemaShape structure is correct", () => {
    const shape = {
        required: ["coding", "testing"],
        optional: ["security", "deployment"],
    };
    assert.deepEqual(shape.required, ["coding", "testing"]);
    assert.deepEqual(shape.optional, ["security", "deployment"]);
});
test("HrRoleProposal structure is correct", () => {
    const proposal = {
        divisionId: "engineering",
        roleId: "new_role",
        name: "New Role",
        promptText: "You are a helpful assistant",
        model: "balanced",
        tools: ["read", "edit"],
        scope: {
            responsibilities: ["code review", "testing"],
            boundaries: ["no production access"],
        },
        inputSchema: {
            required: ["coding"],
        },
        outputSchema: {
            required: [],
        },
        preconditions: [
            { check: "has_testing_framework", description: "Must have testing framework" },
        ],
    };
    assert.equal(proposal.divisionId, "engineering");
    assert.equal(proposal.model, "balanced");
    assert.deepEqual(proposal.tools, ["read", "edit"]);
    assert.deepEqual(proposal.scope.responsibilities, ["code review", "testing"]);
    assert.deepEqual(proposal.preconditions.length, 1);
});
//# sourceMappingURL=index.test.js.map