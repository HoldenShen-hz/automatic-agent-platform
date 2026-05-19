/**
 * Unit tests for ApprovalRoutingService
 *
 * @see src/org-governance/approval-routing/approval-routing-service.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalRoutingService } from "../../../../src/org-governance/approval-routing/approval-routing-service.js";
// Helper to create org nodes
function createOrgNode(overrides = {}) {
    return {
        orgNodeId: overrides.orgNodeId ?? "node-1",
        nodeType: overrides.nodeType ?? "department",
        displayName: overrides.displayName ?? "Test Node",
        parentOrgNodeId: overrides.parentOrgNodeId ?? null,
        ownerUserIds: overrides.ownerUserIds ?? [],
        active: overrides.active ?? true,
        costCenter: overrides.costCenter ?? "",
        metadata: overrides.metadata ?? {},
    };
}
// Helper to create delegations
function createDelegation(overrides = {}) {
    return {
        delegationId: overrides.delegationId ?? "del-1",
        approverId: overrides.approverId ?? "approver-1",
        delegateApproverId: overrides.delegateApproverId ?? "delegate-1",
        scopeNodeIds: overrides.scopeNodeIds ?? [],
        startsAt: overrides.startsAt ?? "2026-04-01T00:00:00.000Z",
        expiresAt: overrides.expiresAt ?? "2026-12-31T23:59:59.999Z",
        active: overrides.active ?? true,
    };
}
// Helper to create escalation rules
function createEscalationRule(overrides = {}) {
    return {
        ruleId: overrides.ruleId ?? "esc-1",
        triggerAfterMinutes: overrides.triggerAfterMinutes ?? 30,
        escalateToApproverId: overrides.escalateToApproverId ?? "escalation-approver",
        appliesToRiskLevels: overrides.appliesToRiskLevels ?? ["high", "critical"],
    };
}
test("ApprovalRoutingService creates service with required orgNodes", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    assert.ok(service);
});
test("ApprovalRoutingService creates service with empty delegations array", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations: [] });
    assert.ok(service);
});
test("ApprovalRoutingService creates service with empty escalation rules array", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: [] });
    assert.ok(service);
});
test("ApprovalRoutingService uses default empty arrays when delegations not provided", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    assert.ok(service);
});
test("ApprovalRoutingService uses default empty arrays when escalationRules not provided", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    assert.ok(service);
});
test("ApprovalRoutingService routes to org node owners", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
    assert.equal(result.delegated, false);
    assert.equal(result.escalatedTo, null);
});
test("ApprovalRoutingService routes to platform_admin when org node has no owners", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: [] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["platform_admin"]);
    assert.equal(result.delegated, false);
});
test("ApprovalRoutingService includes audit record with correct structure", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.ok(result.auditRecord);
    assert.equal(result.auditRecord.recordId.includes("audit_user-1_dept-1"), true);
    assert.equal(result.auditRecord.action, "approval.route");
    assert.equal(result.auditRecord.actorId, "user-1");
    assert.deepStrictEqual(result.auditRecord.reasonCodes, ["approval.direct_route", "approval.routing.org_chart"]);
});
test("ApprovalRoutingService routes to first matching org node when request orgNodeId not found", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] }),
        createOrgNode({ orgNodeId: "dept-2", ownerUserIds: ["vp"] }),
    ];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "nonexistent", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.equal(result.matchedOrgNodeId, "dept-1");
});
test("ApprovalRoutingService applies delegation when approver is delegated", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [
        createDelegation({
            approverId: "director",
            delegateApproverId: "backup-director",
            scopeNodeIds: ["dept-1"],
            startsAt: "2026-04-01T00:00:00.000Z",
            expiresAt: "2026-12-31T23:59:59.999Z",
            active: true,
        }),
    ];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["backup-director"]);
    assert.equal(result.delegated, true);
    assert.ok(result.auditRecord.reasonCodes.includes("approval.delegated"));
});
test("ApprovalRoutingService does not apply delegation when delegation is inactive", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director", active: false })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
    assert.equal(result.delegated, false);
});
test("ApprovalRoutingService does not apply delegation when current time is before start", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [
        createDelegation({
            approverId: "director",
            delegateApproverId: "backup-director",
            startsAt: "2026-05-01T00:00:00.000Z",
            expiresAt: "2026-12-31T23:59:59.999Z",
        }),
    ];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
    assert.equal(result.delegated, false);
});
test("ApprovalRoutingService does not apply delegation when current time is after expiry", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [
        createDelegation({
            approverId: "director",
            delegateApproverId: "backup-director",
            startsAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2026-04-15T00:00:00.000Z",
        }),
    ];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
    assert.equal(result.delegated, false);
});
test("ApprovalRoutingService applies delegation when scopeNodeIds is empty (global delegation)", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director", scopeNodeIds: [] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["backup-director"]);
    assert.equal(result.delegated, true);
});
test("ApprovalRoutingService does not apply delegation when orgNodeId not in scope", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] }),
        createOrgNode({ orgNodeId: "dept-2", ownerUserIds: ["vp"] }),
    ];
    const delegations = [
        createDelegation({ approverId: "director", delegateApproverId: "backup-director", scopeNodeIds: ["dept-2"] }),
    ];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
    assert.equal(result.delegated, false);
});
test("ApprovalRoutingService escalates when time threshold exceeded for high risk", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const escalationRules = [
        createEscalationRule({
            ruleId: "esc-1",
            triggerAfterMinutes: 30,
            escalateToApproverId: "vp-ops",
            appliesToRiskLevels: ["high", "critical"],
        }),
    ];
    const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:45:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director", "vp-ops"]);
    assert.equal(result.escalatedTo, "vp-ops");
    assert.ok(result.auditRecord.reasonCodes.includes("approval.escalated"));
});
test("ApprovalRoutingService does not escalate when time threshold not exceeded", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:15:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
    assert.equal(result.escalatedTo, null);
});
test("ApprovalRoutingService does not escalate when risk level not in appliesToRiskLevels", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
    assert.equal(result.escalatedTo, null);
});
test("ApprovalRoutingService does not duplicate escalated approver if already in chain", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["vp-ops"] })];
    const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["vp-ops"]);
});
test("ApprovalRoutingService escalates for critical risk when rule applies", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "cto", appliesToRiskLevels: ["critical"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "critical", amountUsd: 10000 }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");
    assert.equal(result.escalatedTo, "cto");
});
test("ApprovalRoutingService applies both delegation and escalation", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director" })];
    const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["backup-director", "vp-ops"]);
    assert.equal(result.delegated, true);
    assert.equal(result.escalatedTo, "vp-ops");
});
test("ApprovalRoutingService handles delegation chain then escalation", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [createDelegation({ approverId: "director", delegateApproverId: "interim-director" })];
    const escalationRules = [createEscalationRule({ triggerAfterMinutes: 60, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["medium", "high", "critical"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "medium", amountUsd: 500 }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:30:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["interim-director", "vp-ops"]);
    assert.equal(result.escalatedTo, "vp-ops");
});
test("ApprovalRoutingService includes delegated reason code when delegated", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director" })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.ok(result.auditRecord.reasonCodes.includes("approval.delegated"));
    assert.ok(result.auditRecord.reasonCodes.includes("approval.direct_route") === false);
});
test("ApprovalRoutingService includes direct_route reason code when not delegated", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.ok(result.auditRecord.reasonCodes.includes("approval.direct_route"));
});
test("ApprovalRoutingService includes escalated reason code when escalated", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");
    assert.ok(result.auditRecord.reasonCodes.includes("approval.escalated"));
});
test("ApprovalRoutingService allows when approver chain is not empty", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.equal(result.auditRecord.allowed, true);
});
test("ApprovalRoutingService handles multiple owners", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director", "co-director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director", "co-director"]);
});
test("ApprovalRoutingService routes with all risk levels", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const riskLevels = ["low", "medium", "high", "critical"];
    for (const riskLevel of riskLevels) {
        const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel, amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
        assert.deepStrictEqual(result.approverChain, ["director"], `Failed for risk level: ${riskLevel}`);
    }
});
test("ApprovalRoutingService handles zero amountUsd", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 0 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
});
test("ApprovalRoutingService handles large amountUsd", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "critical", amountUsd: 999999999 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.deepStrictEqual(result.approverChain, ["director"]);
});
test("ApprovalRoutingService finds owner at department level in hierarchy", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"] }),
        createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company", ownerUserIds: ["vp"] }),
        createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division", ownerUserIds: ["director"] }),
        createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept", ownerUserIds: ["manager"] }),
        createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team", ownerUserIds: ["employee"] }),
    ];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const result = service.route({ requesterId: "employee", orgNodeId: "dept", riskLevel: "low", amountUsd: 100 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
    assert.equal(result.matchedOrgNodeId, "dept");
    assert.deepStrictEqual(result.approverChain, ["director"]);
});
test("ApprovalRoutingService exposes amount threshold matrix and sequential chain plan", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director", "vp"] })];
    const thresholdRules = [{ maxAmountUsd: 5_000, targetNodeTypes: ["department"] }];
    const service = new ApprovalRoutingService({ orgNodes: nodes, amountThresholdRules: thresholdRules });
    const matrix = service.getAmountThresholdMatrix();
    const plan = service.planChain({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "medium", amountUsd: 300 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:05:00.000Z", { chainMode: "sequential", timeoutMinutes: 15 });
    assert.equal(matrix.length, 1);
    assert.equal(plan.chainMode, "sequential");
    assert.equal(plan.steps.length, 2);
    assert.deepStrictEqual(plan.steps[0]?.approverIds, ["director"]);
    assert.ok(plan.steps[0]?.deadlineAt?.includes("T"));
});
test("ApprovalRoutingService builds parallel and conditional chain plans", () => {
    const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director", "vp"] })];
    const service = new ApprovalRoutingService({ orgNodes: nodes });
    const parallelPlan = service.planChain({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 600 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:05:00.000Z", { chainMode: "parallel" });
    const conditionalPlan = service.planChain({ requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 600 }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:05:00.000Z", { chainMode: "conditional", conditionalApproverIds: ["legal-reviewer"] });
    assert.equal(parallelPlan.steps.length, 1);
    assert.deepStrictEqual(parallelPlan.steps[0]?.approverIds, ["director", "vp"]);
    assert.equal(conditionalPlan.steps.length, 3);
    assert.deepStrictEqual(conditionalPlan.steps[2]?.approverIds, ["legal-reviewer"]);
});
//# sourceMappingURL=approval-routing-service.test.js.map