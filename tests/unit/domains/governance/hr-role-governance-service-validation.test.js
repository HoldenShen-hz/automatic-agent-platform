/**
 * Unit Tests: HrRoleGovernanceService Validation Paths
 *
 * Tests proposal validation, submission, and registration edge cases
 * for HR role governance in divisions.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { HrRoleGovernanceService, } from "../../../../src/domains/governance/hr-role-governance-service.js";
function makeMockDivision(roles, divisionId = "test_division") {
    return {
        divisions: new Map([
            [
                divisionId,
                {
                    id: divisionId,
                    name: "Test Division",
                    rootPath: "/tmp/test",
                    roles: roles.map((r) => ({
                        id: r.id,
                        name: r.name,
                        promptText: r.promptText ?? `Role ${r.name}`,
                        tools: r.tools,
                        preconditions: [],
                        inputSchema: { required: [] },
                        outputSchema: { required: [] },
                    })),
                    boundaries: [],
                },
            ],
        ]),
        workflows: new Map(),
    };
}
function makeMinimalProposal(overrides = {}) {
    const defaultProposal = {
        divisionId: "test_division",
        roleId: "new_role_001",
        name: "New Test Role",
        promptText: "You are a test role that helps with testing",
        model: "balanced",
        tools: ["read"],
        scope: { responsibilities: ["provide test capabilities"], boundaries: ["read-only access"] },
        inputSchema: { required: ["task"] },
        outputSchema: { required: ["result"] },
        preconditions: [{ check: "always", description: "Always applicable" }],
    };
    return { ...defaultProposal, ...overrides };
}
test("HrRoleGovernanceService validateProposal detects missing scope responsibilities", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        scope: { responsibilities: [], boundaries: ["some boundary"] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("scope_responsibilities_missing")), `Expected scope_responsibilities_missing, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects missing scope boundaries", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        scope: { responsibilities: ["some responsibility"], boundaries: [] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("scope_boundaries_missing")), `Expected scope_boundaries_missing, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects missing preconditions", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        preconditions: [],
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("preconditions_missing")), `Expected preconditions_missing, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects invalid precondition", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        preconditions: [{ check: "", description: "Empty check" }],
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("precondition_invalid")), `Expected precondition_invalid, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects missing prompt", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ promptText: "   " }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("prompt_missing")), `Expected prompt_missing, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects missing input_schema required", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        inputSchema: { required: [] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("input_schema.required_missing")), `Expected input_schema.required_missing, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects missing output_schema required", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        outputSchema: { required: [] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("output_schema.required_missing")), `Expected output_schema.required_missing, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects duplicate field in schema", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        inputSchema: { required: ["field_a"], optional: ["field_a"] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("duplicate_field")), `Expected duplicate_field, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects tool outside division subset", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ tools: ["bash"] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("tool_outside_division_subset")), `Expected tool_outside_division_subset, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects missing tools", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ tools: [] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("tools_missing")), `Expected tools_missing, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects workflow autoApply denied", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        workflowSuggestion: {
            insertAfterStepId: "step_1",
            step: {
                stepId: "new_step",
                roleId: "new_role_001",
                inputKeys: [],
                outputKey: "output",
                timeoutMs: 5000,
                maxAttempts: 1,
                autoApply: true,
            },
        },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("workflow_auto_apply_denied")), `Expected workflow_auto_apply_denied, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects workflow role mismatch", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        workflowSuggestion: {
            insertAfterStepId: "step_1",
            step: {
                stepId: "new_step",
                roleId: "different_role",
                inputKeys: [],
                outputKey: "output",
                timeoutMs: 5000,
                maxAttempts: 1,
            },
        },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("workflow_role_mismatch")), `Expected workflow_role_mismatch, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects invalid max_instances", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ maxInstances: 0 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("max_instances_invalid")), `Expected max_instances_invalid, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects negative max_instances", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ maxInstances: -1 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("max_instances_invalid")), `Expected max_instances_invalid, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal warns for read-only role", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ tools: ["read", "question"] }));
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some((w) => w.includes("read_only_role")), `Expected read_only_role warning, got: ${result.warnings.join(", ")}`);
});
test("HrRoleGovernanceService submitProposal returns null approvalRequest when validation fails", () => {
    const registry = makeMockDivision([
        { id: "existing_role", name: "Existing Role", tools: ["read"] },
    ]);
    const mockApprovalService = {
        createRequest: () => ({ id: "approval_1" }),
    };
    const service = new HrRoleGovernanceService(registry, mockApprovalService);
    const result = service.submitProposal({
        gapAnalysisRequest: {
            taskId: "task_1",
            taskDescription: "Test",
            targetDivisionId: "test_division",
            triggerReason: "no_role_match",
            requestedCapabilities: [],
        },
        proposal: makeMinimalProposal({ roleId: "existing_role" }),
    });
    assert.equal(result.approvalRequest, null);
});
test("HrRoleGovernanceService submitProposal returns null approvalRequest when no approvalService", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.submitProposal({
        gapAnalysisRequest: {
            taskId: "task_1",
            taskDescription: "Test",
            targetDivisionId: "test_division",
            triggerReason: "no_role_match",
            requestedCapabilities: [],
        },
        proposal: makeMinimalProposal(),
    });
    assert.equal(result.approvalRequest, null);
});
test("HrRoleGovernanceService registerApprovedRole throws when registry unavailable", () => {
    const service = new HrRoleGovernanceService(null, null);
    assert.throws(() => service.registerApprovedRole({
        proposal: makeMinimalProposal(),
        approvalStatus: "approved",
    }), /division\.registry_unavailable/);
});
test("HrRoleGovernanceService registerApprovedRole throws when not approved", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    assert.throws(() => service.registerApprovedRole({
        proposal: makeMinimalProposal(),
        approvalStatus: "rejected",
    }), /role_registration_requires_approval/);
});
test("HrRoleGovernanceService registerApprovedRole throws when proposal invalid", () => {
    const registry = makeMockDivision([
        { id: "existing_role", name: "Existing Role", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    assert.throws(() => service.registerApprovedRole({
        proposal: makeMinimalProposal({ roleId: "existing_role" }),
        approvalStatus: "approved",
    }), /role_proposal_invalid/);
});
test("HrRoleGovernanceService validateProposal detects empty precondition check", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        preconditions: [{ check: "   ", description: "Valid description" }],
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("precondition_invalid")), `Expected precondition_invalid, got: ${result.errors.join(", ")}`);
});
test("HrRoleGovernanceService validateProposal detects empty precondition description", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        preconditions: [{ check: "valid_check", description: "" }],
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("precondition_invalid")), `Expected precondition_invalid, got: ${result.errors.join(", ")}`);
});
//# sourceMappingURL=hr-role-governance-service-validation.test.js.map