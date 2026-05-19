/**
 * Unit Tests: HR Role Governance Service - Advanced
 *
 * Tests submitProposal and registerApprovedRole methods
 * for HR role governance in divisions.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { HrRoleGovernanceService, } from "../../../../src/domains/governance/hr-role-governance-service.js";
/** Minimal DivisionRegistry for testing */
function makeMockDivision(roles) {
    return {
        divisions: new Map([
            [
                "test_division",
                {
                    id: "test_division",
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
function makeGapAnalysisRequest(overrides = {}) {
    return {
        taskId: "task_001",
        taskDescription: "Test task",
        targetDivisionId: "test_division",
        triggerReason: "no_role_match",
        requestedCapabilities: ["read"],
        ...overrides,
    };
}
test("HrRoleGovernanceService submitProposal returns gap analysis and validation without approval service", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.submitProposal({
        gapAnalysisRequest: makeGapAnalysisRequest(),
        proposal: makeMinimalProposal(),
    });
    assert.equal(result.gapAnalysis.taskId, "task_001");
    assert.equal(result.validation.valid, true);
    assert.equal(result.approvalRequest, null);
});
test("HrRoleGovernanceService submitProposal creates approval request when validation passes and approval service exists", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const mockApprovalService = {
        createRequest: (input) => {
            return {
                approvalId: "approval_001",
                taskId: input.taskId,
                reason: input.reason,
                riskLevel: input.riskLevel,
                options: input.options,
                context: input.context,
                timeoutPolicy: input.timeoutPolicy,
            };
        },
    };
    const service = new HrRoleGovernanceService(registry, mockApprovalService);
    const result = service.submitProposal({
        gapAnalysisRequest: makeGapAnalysisRequest(),
        proposal: makeMinimalProposal(),
    });
    assert.equal(result.validation.valid, true);
    assert.ok(result.approvalRequest !== null);
    assert.equal(result.approvalRequest?.approvalId, "approval_001");
});
test("HrRoleGovernanceService submitProposal does not create approval request when validation fails", () => {
    const registry = makeMockDivision([]);
    const mockApprovalService = {
        createRequest: () => {
            throw new Error("Should not be called");
        },
    };
    const service = new HrRoleGovernanceService(registry, mockApprovalService);
    const result = service.submitProposal({
        gapAnalysisRequest: makeGapAnalysisRequest(),
        proposal: makeMinimalProposal({ name: "   " }),
    });
    assert.equal(result.validation.valid, false);
    assert.equal(result.approvalRequest, null);
});
test("HrRoleGovernanceService registerApprovedRole adds role to division", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read", "question"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const newRegistry = service.registerApprovedRole({
        proposal: makeMinimalProposal({
            roleId: "proposed_role",
            tools: ["read", "question"],
        }),
        approvalStatus: "approved",
    });
    const division = newRegistry.divisions.get("test_division");
    assert.ok(division, "Division should exist");
    assert.ok(division.roles.some((r) => r.id === "proposed_role"), "New role should be registered");
});
test("HrRoleGovernanceService registerApprovedRole throws when approval status is not approved", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    assert.throws(() => service.registerApprovedRole({
        proposal: makeMinimalProposal(),
        approvalStatus: "rejected",
    }), /hr.role_registration_requires_approval/);
});
test("HrRoleGovernanceService registerApprovedRole throws when proposal is invalid", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    assert.throws(() => service.registerApprovedRole({
        proposal: makeMinimalProposal({ name: "   " }),
        approvalStatus: "approved",
    }), /hr.role_proposal_invalid/);
});
test("HrRoleGovernanceService registerApprovedRole throws when registry is unavailable", () => {
    const service = new HrRoleGovernanceService(null, null);
    assert.throws(() => service.registerApprovedRole({
        proposal: makeMinimalProposal(),
        approvalStatus: "approved",
    }), /division.registry_unavailable/);
});
test("HrRoleGovernanceService validateProposal detects duplicate role ID in same division", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ roleId: "role_reader" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.role_duplicate")));
});
test("HrRoleGovernanceService validateProposal detects empty prompt text", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ promptText: "   " }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.prompt_missing")));
});
test("HrRoleGovernanceService validateProposal detects missing responsibilities", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ scope: { responsibilities: [], boundaries: ["read-only"] } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.scope_responsibilities_missing")));
});
test("HrRoleGovernanceService validateProposal detects missing boundaries", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ scope: { responsibilities: ["test"], boundaries: [] } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.scope_boundaries_missing")));
});
test("HrRoleGovernanceService validateProposal detects missing preconditions", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ preconditions: [] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.preconditions_missing")));
});
test("HrRoleGovernanceService validateProposal detects invalid preconditions", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ preconditions: [{ check: "   ", description: "test" }] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.precondition_invalid")));
});
test("HrRoleGovernanceService validateProposal detects empty input schema required", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ inputSchema: { required: [] } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.input_schema.required_missing")));
});
test("HrRoleGovernanceService validateProposal detects output schema required missing", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ outputSchema: { required: [] } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.output_schema.required_missing")));
});
test("HrRoleGovernanceService validateProposal detects duplicate fields in schema", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        inputSchema: { required: ["task"],
            optional: ["task"] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.input_schema.duplicate_field")));
});
test("HrRoleGovernanceService validateProposal detects missing tools", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ tools: [] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.tools_missing")));
});
test("HrRoleGovernanceService validateProposal detects unknown tools", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ tools: ["read", "unknown_tool"] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.tool_unknown")));
});
test("HrRoleGovernanceService validateProposal detects tools outside division tool union", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ tools: ["read", "bash"] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.tool_outside_division_subset")));
});
test("HrRoleGovernanceService validateProposal detects invalid maxInstances", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ maxInstances: 0 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.max_instances_invalid")));
});
test("HrRoleGovernanceService validateProposal detects workflow auto apply denied", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        workflowSuggestion: {
            insertAfterStepId: "step_1",
            step: {
                stepId: "step_2",
                roleId: "new_role_001",
                outputKey: "output",
                timeoutMs: 60000,
                maxAttempts: 1,
                autoApply: true,
            },
        },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.workflow_auto_apply_denied")));
});
test("HrRoleGovernanceService validateProposal detects workflow role mismatch", () => {
    const registry = makeMockDivision([]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({
        roleId: "new_role_001",
        workflowSuggestion: {
            insertAfterStepId: "step_1",
            step: {
                stepId: "step_2",
                roleId: "different_role",
                outputKey: "output",
                timeoutMs: 60000,
                maxAttempts: 1,
            },
        },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hr.workflow_role_mismatch")));
});
test("HrRoleGovernanceService validateProposal warns about read-only role", () => {
    const registry = makeMockDivision([
        { id: "role_reader", name: "Reader", tools: ["read", "question"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.validateProposal(makeMinimalProposal({ tools: ["read", "question"] }));
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some((w) => w.includes("hr.read_only_role")));
});
test("HrRoleGovernanceService analyzeGap returns matched roles sorted by score", () => {
    const registry = makeMockDivision([
        { id: "role_coder", name: "Coder", tools: ["bash", "write", "read"] },
        { id: "role_reader", name: "Reader", tools: ["read"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.analyzeGap({
        taskId: "task_sorted",
        taskDescription: "bash write read",
        targetDivisionId: "test_division",
        triggerReason: "no_role_match",
        requestedCapabilities: ["bash", "write", "read"],
    });
    assert.ok(result.matchedRoleIds.length > 0);
    assert.equal(result.matchedRoleIds[0], "role_coder");
});
test("HrRoleGovernanceService analyzeGap handles scope_exceeded trigger reason", () => {
    const registry = makeMockDivision([
        { id: "role_coder", name: "Coder", tools: ["bash", "write"] },
    ]);
    const service = new HrRoleGovernanceService(registry, null);
    const result = service.analyzeGap({
        taskId: "task_scope",
        taskDescription: "bash write",
        targetDivisionId: "test_division",
        triggerReason: "scope_exceeded",
        requestedCapabilities: ["bash"],
    });
    assert.equal(result.triggerReason, "scope_exceeded");
    assert.ok(result.matchedRoleIds.includes("role_coder"));
});
//# sourceMappingURL=hr-role-governance-service-advanced.test.js.map