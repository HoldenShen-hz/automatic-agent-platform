/**
 * Unit tests for approval-routing/route-engine module
 *
 * @see src/org-governance/approval-routing/route-engine/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalRouteRequestSchema, OrgChartRoutingStrategy, AmountBasedRoutingStrategy, resolveAmountRoute, applySodPolicy, resolveApprovalRoute, } from "../../../src/org-governance/approval-routing/route-engine/index.js";
import { resolveDelegatedApprover, } from "../../../src/org-governance/approval-routing/delegation/index.js";
// ─────────────────────────────────────────────────────────────────────────────
// Mock OrgNode factory
// ─────────────────────────────────────────────────────────────────────────────
function createOrgNode(overrides) {
    return {
        orgNodeId: overrides.orgNodeId,
        nodeType: overrides.nodeType,
        displayName: overrides.displayName ?? `Node ${overrides.orgNodeId}`,
        parentOrgNodeId: overrides.parentOrgNodeId ?? null,
        ownerUserIds: overrides.ownerUserIds ?? [],
        active: overrides.active ?? true,
        costCenter: overrides.costCenter ?? "",
        metadata: overrides.metadata ?? {},
    };
}
const COMPANY = createOrgNode({ orgNodeId: "company-1", nodeType: "company" });
const DIVISION = createOrgNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1" });
const DEPARTMENT = createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "division-1" });
const TEAM = createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["team-manager"] });
const SAMPLE_NODES = [COMPANY, DIVISION, DEPARTMENT, TEAM];
// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Tests
// ─────────────────────────────────────────────────────────────────────────────
test("ApprovalRouteRequestSchema validates valid request", () => {
    const request = ApprovalRouteRequestSchema.parse({
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 1000,
    });
    assert.equal(request.requesterId, "user-1");
    assert.equal(request.orgNodeId, "dept-1");
    assert.equal(request.riskLevel, "medium");
    assert.equal(request.amountUsd, 1000);
});
test("ApprovalRouteRequestSchema applies defaults", () => {
    const request = ApprovalRouteRequestSchema.parse({
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "low",
    });
    assert.deepEqual(request.requesterManagerIds, []);
    assert.deepEqual(request.conflictedApproverIds, []);
    assert.equal(request.policyVersion, "approval-routing/v2");
    assert.equal(request.orgVersion, "org-chart/v2");
    assert.deepEqual(request.evidenceRefs, []);
});
test("ApprovalRouteRequestSchema rejects empty requesterId", () => {
    assert.throws(() => ApprovalRouteRequestSchema.parse({
        requesterId: "",
        orgNodeId: "dept-1",
        riskLevel: "low",
    }));
});
test("ApprovalRouteRequestSchema validates riskLevel enum", () => {
    assert.equal(ApprovalRouteRequestSchema.parse({ requesterId: "u", orgNodeId: "n", riskLevel: "low" }).riskLevel, "low");
    assert.equal(ApprovalRouteRequestSchema.parse({ requesterId: "u", orgNodeId: "n", riskLevel: "medium" }).riskLevel, "medium");
    assert.equal(ApprovalRouteRequestSchema.parse({ requesterId: "u", orgNodeId: "n", riskLevel: "high" }).riskLevel, "high");
    assert.equal(ApprovalRouteRequestSchema.parse({ requesterId: "u", orgNodeId: "n", riskLevel: "critical" }).riskLevel, "critical");
    assert.throws(() => ApprovalRouteRequestSchema.parse({ requesterId: "u", orgNodeId: "n", riskLevel: "invalid" }));
});
// ─────────────────────────────────────────────────────────────────────────────
// OrgChartRoutingStrategy Tests
// ─────────────────────────────────────────────────────────────────────────────
test("OrgChartRoutingStrategy.selectNode returns exact match", () => {
    const strategy = new OrgChartRoutingStrategy();
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 0,
    };
    const result = strategy.selectNode(SAMPLE_NODES, request);
    assert.equal(result?.orgNodeId, "dept-1");
});
test("OrgChartRoutingStrategy.selectNode falls back to first node when no match", () => {
    const strategy = new OrgChartRoutingStrategy();
    const request = {
        requesterId: "user-1",
        orgNodeId: "nonexistent",
        riskLevel: "medium",
        amountUsd: 0,
    };
    const result = strategy.selectNode(SAMPLE_NODES, request);
    assert.equal(result?.orgNodeId, "company-1"); // First node
});
test("OrgChartRoutingStrategy prefers active nodes when finding by exact match", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true, parentOrgNodeId: "company-1" }),
        createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: false, parentOrgNodeId: "company-1" }),
    ];
    const strategy = new OrgChartRoutingStrategy();
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 0,
    };
    const result = strategy.selectNode(nodes, request);
    assert.equal(result?.orgNodeId, "dept-1");
    assert.equal(result?.active, true);
});
test("OrgChartRoutingStrategy.returns null for empty nodes array", () => {
    const strategy = new OrgChartRoutingStrategy();
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 0,
    };
    const result = strategy.selectNode([], request);
    assert.equal(result, null);
});
// ─────────────────────────────────────────────────────────────────────────────
// AmountBasedRoutingStrategy Tests
// ─────────────────────────────────────────────────────────────────────────────
test("AmountBasedRoutingStrategy.selectNode respects amount threshold", () => {
    const rules = [
        { maxAmountUsd: 1000, targetNodeTypes: ["department"] },
        { maxAmountUsd: 10000, targetNodeTypes: ["division"] },
    ];
    const strategy = new AmountBasedRoutingStrategy(rules);
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 500,
    };
    const result = strategy.selectNode(SAMPLE_NODES, request);
    assert.ok(result != null);
    assert.ok(["department", "division"].includes(result?.nodeType ?? ""));
});
test("AmountBasedRoutingStrategy.selectNode uses fallback to company when no rule matches", () => {
    const rules = [
        { maxAmountUsd: 100, targetNodeTypes: ["department"] },
    ];
    const strategy = new AmountBasedRoutingStrategy(rules);
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 1000000, // Very high amount
    };
    const result = strategy.selectNode(SAMPLE_NODES, request);
    assert.equal(result?.nodeType, "company");
});
test("AmountBasedRoutingStrategy.selectNode returns null for empty nodes", () => {
    const rules = [
        { maxAmountUsd: 1000, targetNodeTypes: ["department"] },
    ];
    const strategy = new AmountBasedRoutingStrategy(rules);
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 500,
    };
    const result = strategy.selectNode([], request);
    assert.equal(result, null);
});
// ─────────────────────────────────────────────────────────────────────────────
// resolveAmountRoute Tests
// ─────────────────────────────────────────────────────────────────────────────
test("resolveAmountRoute returns matching node for amount within threshold", () => {
    const rules = [
        { maxAmountUsd: 5000, targetNodeTypes: ["department", "team"] },
    ];
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 1000,
    };
    const result = resolveAmountRoute(SAMPLE_NODES, request, rules);
    assert.ok(result != null);
    assert.ok(["department", "team"].includes(result?.nodeType ?? ""));
});
test("resolveAmountRoute uses fallback company when no rule matches", () => {
    const rules = [
        { maxAmountUsd: 100, targetNodeTypes: ["team"] },
    ];
    const request = {
        requesterId: "user-1",
        orgNodeId: "team-1",
        riskLevel: "medium",
        amountUsd: 10000,
    };
    const result = resolveAmountRoute(SAMPLE_NODES, request, rules);
    assert.equal(result?.nodeType, "company");
});
test("resolveAmountRoute prefers nodes within request orgNodeId or its parent", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "dept-2", nodeType: "department", parentOrgNodeId: "division-1" }),
        createOrgNode({ orgNodeId: "team-outside", nodeType: "team", parentOrgNodeId: "dept-2", ownerUserIds: ["mgr-outside"] }),
        createOrgNode({ orgNodeId: "team-inside", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["mgr-inside"] }),
    ];
    const rules = [
        { maxAmountUsd: 10000, targetNodeTypes: ["team"] },
    ];
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 5000,
    };
    const result = resolveAmountRoute(nodes, request, rules);
    assert.equal(result?.orgNodeId, "team-inside");
});
// ─────────────────────────────────────────────────────────────────────────────
// applySodPolicy Tests
// ─────────────────────────────────────────────────────────────────────────────
test("applySodPolicy filters out initiator from approvers", () => {
    const approvers = ["user-1", "user-2", "user-3"];
    const result = applySodPolicy({
        requesterId: "user-2",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 0,
        requesterManagerIds: [],
        conflictedApproverIds: [],
        policyVersion: "approval-routing/v2",
        orgVersion: "org-chart/v2",
        evidenceRefs: [],
    }, approvers, SAMPLE_NODES, "dept-1");
    assert.deepStrictEqual(result, ["user-1", "user-3"]);
});
test("applySodPolicy returns all approvers when initiator not in list", () => {
    const approvers = ["user-1", "user-2", "user-3"];
    const result = applySodPolicy({
        requesterId: "user-4",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 0,
        requesterManagerIds: [],
        conflictedApproverIds: [],
        policyVersion: "approval-routing/v2",
        orgVersion: "org-chart/v2",
        evidenceRefs: [],
    }, approvers, SAMPLE_NODES, "dept-1");
    assert.deepStrictEqual(result, ["user-1", "user-2", "user-3"]);
});
test("applySodPolicy handles empty approver list", () => {
    const result = applySodPolicy({
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 0,
        requesterManagerIds: [],
        conflictedApproverIds: [],
        policyVersion: "approval-routing/v2",
        orgVersion: "org-chart/v2",
        evidenceRefs: [],
    }, [], SAMPLE_NODES, "dept-1");
    assert.deepStrictEqual(result, []);
});
// ─────────────────────────────────────────────────────────────────────────────
// resolveApprovalRoute Tests
// ─────────────────────────────────────────────────────────────────────────────
test("resolveApprovalRoute uses org_chart strategy by default", () => {
    const request = {
        requesterId: "user-1",
        orgNodeId: "team-1",
        riskLevel: "medium",
        amountUsd: 0,
    };
    const result = resolveApprovalRoute(SAMPLE_NODES, request);
    assert.equal(result.routingStrategy, "org_chart");
    assert.ok(result.approverChain.length > 0);
    assert.equal(result.matchedOrgNodeId, "team-1");
});
test("resolveApprovalRoute applies delegation map", () => {
    const request = {
        requesterId: "user-1",
        orgNodeId: "team-1",
        riskLevel: "medium",
        amountUsd: 0,
    };
    const delegationMap = {
        "team-manager": "backup-manager",
    };
    const result = resolveApprovalRoute(SAMPLE_NODES, request, delegationMap);
    assert.equal(result.delegated, true);
    assert.ok(result.approverChain.includes("backup-manager"));
});
test("resolveApprovalRoute uses amount_based strategy when rules exist", () => {
    const rules = [
        { maxAmountUsd: 5000, targetNodeTypes: ["department"] },
    ];
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-1",
        riskLevel: "medium",
        amountUsd: 1000,
    };
    const result = resolveApprovalRoute(SAMPLE_NODES, request, {}, rules);
    assert.equal(result.routingStrategy, "amount_based");
});
test("resolveApprovalRoute returns platform_admin fallback when no owners", () => {
    const nodesWithoutOwners = [
        createOrgNode({ orgNodeId: "dept-no-owner", nodeType: "department", parentOrgNodeId: null }),
    ];
    const request = {
        requesterId: "user-1",
        orgNodeId: "dept-no-owner",
        riskLevel: "low",
        amountUsd: 0,
    };
    const result = resolveApprovalRoute(nodesWithoutOwners, request);
    assert.deepStrictEqual(result.approverChain, ["platform_admin"]);
});
test("resolveApprovalRoute applies SoD policy", () => {
    const nodesWithMembers = [
        createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["member-1", "member-2"] }),
    ];
    const request = {
        requesterId: "member-1",
        orgNodeId: "team-1",
        riskLevel: "medium",
        amountUsd: 0,
    };
    const result = resolveApprovalRoute(nodesWithMembers, request);
    assert.ok(!result.approverChain.includes("member-1"), "Initiator should be filtered out");
    assert.deepStrictEqual(result.approverChain, []);
    assert.deepStrictEqual(result.routeSnapshot.sodSnapshot.blockedApproverIds.sort(), ["member-1", "member-2"]);
});
// ─────────────────────────────────────────────────────────────────────────────
// resolveDelegatedApprover Tests (from delegation sub-module)
// ─────────────────────────────────────────────────────────────────────────────
test("resolveDelegatedApprover returns delegate when delegation active and in scope", () => {
    const delegations = [
        {
            delegationId: "del-1",
            approverId: "team-manager",
            delegateApproverId: "backup-manager",
            scopeNodeIds: ["team-1"],
            startsAt: "2026-04-01T00:00:00.000Z",
            expiresAt: "2026-04-30T00:00:00.000Z",
            active: true,
        },
    ];
    const result = resolveDelegatedApprover(delegations, "team-manager", "team-1", "2026-04-15T00:00:00.000Z");
    assert.equal(result, "backup-manager");
});
test("resolveDelegatedApprover returns original approver when delegation not active", () => {
    const delegations = [
        {
            delegationId: "del-1",
            approverId: "team-manager",
            delegateApproverId: "backup-manager",
            scopeNodeIds: [],
            startsAt: "2026-04-01T00:00:00.000Z",
            expiresAt: "2026-04-30T00:00:00.000Z",
            active: false, // Inactive
        },
    ];
    const result = resolveDelegatedApprover(delegations, "team-manager", "team-1", "2026-04-15T00:00:00.000Z");
    assert.equal(result, "team-manager");
});
test("resolveDelegatedApprover returns original approver when outside time window", () => {
    const delegations = [
        {
            delegationId: "del-1",
            approverId: "team-manager",
            delegateApproverId: "backup-manager",
            scopeNodeIds: [],
            startsAt: "2026-05-01T00:00:00.000Z", // Future
            expiresAt: "2026-05-30T00:00:00.000Z",
            active: true,
        },
    ];
    const result = resolveDelegatedApprover(delegations, "team-manager", "team-1", "2026-04-15T00:00:00.000Z");
    assert.equal(result, "team-manager");
});
test("resolveDelegatedApprover returns original approver when scope does not match", () => {
    const delegations = [
        {
            delegationId: "del-1",
            approverId: "team-manager",
            delegateApproverId: "backup-manager",
            scopeNodeIds: ["other-team"], // Different scope
            startsAt: "2026-04-01T00:00:00.000Z",
            expiresAt: "2026-04-30T00:00:00.000Z",
            active: true,
        },
    ];
    const result = resolveDelegatedApprover(delegations, "team-manager", "team-1", "2026-04-15T00:00:00.000Z");
    assert.equal(result, "team-manager");
});
test("resolveDelegatedApprover applies empty scope as wildcard", () => {
    const delegations = [
        {
            delegationId: "del-1",
            approverId: "team-manager",
            delegateApproverId: "backup-manager",
            scopeNodeIds: [], // Empty = applies to all
            startsAt: "2026-04-01T00:00:00.000Z",
            expiresAt: "2026-04-30T00:00:00.000Z",
            active: true,
        },
    ];
    const result = resolveDelegatedApprover(delegations, "team-manager", "any-node", "2026-04-15T00:00:00.000Z");
    assert.equal(result, "backup-manager");
});
test("resolveDelegatedApprover returns original approver when no delegation found", () => {
    const delegations = [];
    const result = resolveDelegatedApprover(delegations, "unknown-approver", "team-1", "2026-04-15T00:00:00.000Z");
    assert.equal(result, "unknown-approver");
});
//# sourceMappingURL=route-engine.test.js.map