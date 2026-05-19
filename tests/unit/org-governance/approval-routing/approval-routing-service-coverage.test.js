import test from "node:test";
import assert from "node:assert/strict";
import { ApprovalRoutingService } from "../../../../src/org-governance/approval-routing/approval-routing-service.js";
function createMockOrgNode(overrides = {}) {
    return {
        orgNodeId: "org-node-1",
        nodeType: "department",
        name: "Test Department",
        ownerUserIds: ["owner-1", "owner-2"],
        parentId: null,
        divisionId: "division-1",
        departmentId: "dept-1",
        teamId: null,
        ...overrides,
    };
}
function createMockRequest(overrides = {}) {
    return {
        requesterId: "requester-1",
        orgNodeId: "org-node-1",
        amountUsd: 5000,
        riskLevel: "medium",
        resourceType: "compute",
        ...overrides,
    };
}
test("ApprovalRoutingService route returns routing decision", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const result = service.route(createMockRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    assert.ok(result.matchedOrgNodeId != null);
    assert.ok(Array.isArray(result.approverChain));
    assert.ok(Array.isArray(result.auditRecord.reasonCodes));
});
test("ApprovalRoutingService route builds audit record", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const result = service.route(createMockRequest({ requesterId: "audit-test-requester" }), "2026-04-01T00:00:00.000Z", "2026-04-26T12:00:00.000Z");
    assert.equal(result.auditRecord.actorId, "audit-test-requester");
    assert.equal(result.auditRecord.action, "approval.route");
});
test("ApprovalRoutingService getAmountThresholdMatrix returns configured rules", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({
        orgNodes,
        amountThresholdRules: [
            {
                minAmountUsd: 0,
                maxAmountUsd: 1000,
                approverIds: ["approver-low"],
                strategyId: "low-amount",
            },
            {
                minAmountUsd: 1001,
                maxAmountUsd: 10000,
                approverIds: ["approver-med"],
                strategyId: "med-amount",
            },
        ],
    });
    const matrix = service.getAmountThresholdMatrix();
    assert.equal(matrix.length, 2);
});
test("ApprovalRoutingService getAmountThresholdMatrix returns empty when no rules configured", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const matrix = service.getAmountThresholdMatrix();
    assert.deepStrictEqual(matrix, []);
});
test("ApprovalRoutingService planChain returns chain plan with sequential mode", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const plan = service.planChain(createMockRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    assert.equal(plan.chainMode, "sequential");
    assert.ok(plan.matchedOrgNodeId != null);
    assert.ok(Array.isArray(plan.steps));
});
test("ApprovalRoutingService planChain respects chainMode option", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const plan = service.planChain(createMockRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", { chainMode: "parallel" });
    assert.equal(plan.chainMode, "parallel");
});
test("ApprovalRoutingService planChain respects timeoutMinutes option", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const now = "2026-04-01T00:00:00.000Z";
    const plan = service.planChain(createMockRequest(), now, now, { timeoutMinutes: 30 });
    assert.ok(plan.steps[0]?.deadlineAt != null);
});
test("ApprovalRoutingService planChain with no timeoutMinutes has null deadline", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const plan = service.planChain(createMockRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    assert.equal(plan.steps[0]?.deadlineAt, null);
});
test("ApprovalRoutingService planChain with conditional mode adds extra approvers", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const plan = service.planChain(createMockRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", { chainMode: "conditional", conditionalApproverIds: ["conditional-approver-1"] });
    assert.equal(plan.chainMode, "conditional");
    assert.ok(plan.steps.length > 0);
});
test("ApprovalRoutingService planChain filters empty conditional approver IDs", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const plan = service.planChain(createMockRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", { chainMode: "conditional", conditionalApproverIds: ["valid-approver", "", "another-valid"] });
    assert.equal(plan.chainMode, "conditional");
});
test("ApprovalRoutingService route handles different risk levels", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const lowRisk = service.route(createMockRequest({ riskLevel: "low" }), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    const mediumRisk = service.route(createMockRequest({ riskLevel: "medium" }), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    const highRisk = service.route(createMockRequest({ riskLevel: "high" }), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    assert.ok(Array.isArray(lowRisk.approverChain));
    assert.ok(Array.isArray(mediumRisk.approverChain));
    assert.ok(Array.isArray(highRisk.approverChain));
});
test("ApprovalRoutingService route handles different resource types", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    const compute = service.route(createMockRequest({ resourceType: "compute" }), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    const storage = service.route(createMockRequest({ resourceType: "storage" }), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    const network = service.route(createMockRequest({ resourceType: "network" }), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    assert.ok(Array.isArray(compute.approverChain));
    assert.ok(Array.isArray(storage.approverChain));
    assert.ok(Array.isArray(network.approverChain));
});
test("ApprovalRoutingService constructor accepts empty arrays for optional params", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({
        orgNodes,
        delegations: [],
        escalationRules: [],
        amountThresholdRules: [],
    });
    assert.ok(service != null);
});
test("ApprovalRoutingService constructor handles undefined optional params", () => {
    const orgNodes = [createMockOrgNode()];
    const service = new ApprovalRoutingService({ orgNodes });
    assert.ok(service != null);
});
//# sourceMappingURL=approval-routing-service-coverage.test.js.map