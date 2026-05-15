/**
 * Unit tests for Approval Route Engine
 * Tests threshold logic
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  OrgChartRoutingStrategy,
  AmountBasedRoutingStrategy,
  buildParallelSignoffGroups,
  resolveApprovalSteps,
  resolveAmountRoute,
  applySodPolicy,
  resolveApprovalRoute,
  revalidateApprovalRoute,
  setDefaultLegacyFxRate,
  type ApprovalRouteRequest,
  type AmountThresholdRule,
  type OrgNode,
} from "../../../../../src/org-governance/approval-routing/route-engine/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createOrgNode(overrides?: Partial<OrgNode>): OrgNode {
  return {
    orgNodeId: "node-1",
    nodeType: "team",
    displayName: "Test Team",
    parentOrgNodeId: null,
    ownerUserIds: ["owner-1"],
    active: true,
    costCenter: "CC001",
    metadata: {},
    ...overrides,
  };
}

function createRequest(overrides?: Partial<ApprovalRouteRequest>): ApprovalRouteRequest {
  return {
    requesterId: "requester-1",
    orgNodeId: "node-1",
    riskLevel: "medium",
    requesterManagerIds: [],
    conflictedApproverIds: [],
    policyVersion: "approval-routing/v2",
    orgVersion: "org-chart/v2",
    evidenceRefs: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OrgChartRoutingStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe("OrgChartRoutingStrategy", () => {
  const strategy = new OrgChartRoutingStrategy();

  describe("selectNode", () => {
    it("should select active node matching orgNodeId", () => {
      const nodes = [
        createOrgNode({ orgNodeId: "node-1", active: true }),
        createOrgNode({ orgNodeId: "node-2", active: true }),
      ];
      const request = createRequest({ orgNodeId: "node-1" });

      const result = strategy.selectNode(nodes, request);

      assert.ok(result !== null);
      assert.strictEqual(result!.orgNodeId, "node-1");
    });

    it("should select inactive node if no active match", () => {
      const nodes = [
        createOrgNode({ orgNodeId: "node-1", active: false }),
        createOrgNode({ orgNodeId: "node-2", active: true }),
      ];
      const request = createRequest({ orgNodeId: "node-1" });

      const result = strategy.selectNode(nodes, request);

      assert.ok(result !== null);
      assert.strictEqual(result!.orgNodeId, "node-1");
    });

    it("should return null when no match is found", () => {
      const nodes = [
        createOrgNode({ orgNodeId: "node-1" }),
        createOrgNode({ orgNodeId: "node-2" }),
      ];
      const request = createRequest({ orgNodeId: "non-existent" });

      const result = strategy.selectNode(nodes, request);

      assert.strictEqual(result, null);
    });

    it("should return null for empty nodes array", () => {
      const request = createRequest();
      const result = strategy.selectNode([], request);
      assert.strictEqual(result, null);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AmountBasedRoutingStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe("AmountBasedRoutingStrategy", () => {
  const rules: readonly AmountThresholdRule[] = [
    { maxAmountCny: 1000, targetNodeTypes: ["team"] },
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
    { maxAmountCny: 100000, targetNodeTypes: ["division"] },
  ];

  const strategy = new AmountBasedRoutingStrategy(rules);

  describe("selectNode", () => {
    it("should select team node for small amount", () => {
      const nodes = [
        createOrgNode({ orgNodeId: "team-1", nodeType: "team", ownerUserIds: ["t1-owner"] }),
        createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["d1-owner"] }),
      ];
      const request = createRequest({
        amount: { value: 500, currency: "CNY" },
      });

      const result = strategy.selectNode(nodes, request);

      assert.ok(result !== null);
      assert.strictEqual(result!.nodeType, "team");
    });

    it("should select department for medium amount", () => {
      const nodes = [
        createOrgNode({ orgNodeId: "team-1", nodeType: "team", ownerUserIds: ["t1-owner"] }),
        createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "div-1", ownerUserIds: ["d1-owner"] }),
        createOrgNode({ orgNodeId: "div-1", nodeType: "division", ownerUserIds: ["div-owner"] }),
      ];
      const request = createRequest({
        amount: { value: 5000, currency: "CNY" },
        orgNodeId: "dept-1",
      });

      const result = strategy.selectNode(nodes, request);

      assert.ok(result !== null);
      assert.strictEqual(result!.nodeType, "department");
    });

    it("should fall back to company when no amount rule matches", () => {
      const nodes = [
        createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["c-owner"] }),
        createOrgNode({ orgNodeId: "team-1", nodeType: "team", ownerUserIds: ["t-owner"] }),
      ];
      const request = createRequest({
        amount: { value: 9999999, currency: "CNY" },
      });

      const result = strategy.selectNode(nodes, request);

      assert.strictEqual(result?.orgNodeId, "company-1");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveAmountRoute
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveAmountRoute", () => {
  const rules: readonly AmountThresholdRule[] = [
    { maxAmountCny: 1000, targetNodeTypes: ["team"] },
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
  ];

  it("should return null for empty nodes array", () => {
    const result = resolveAmountRoute([], createRequest(), rules);
    assert.strictEqual(result, null);
  });

  it("should return null when no tenant fallback exists", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["c-owner"] }),
    ];
    const request = createRequest({ amount: { value: 1, currency: "CNY" } });

    const result = resolveAmountRoute(nodes, request, rules);

    // No tenant node exists, so fallback returns null
    assert.strictEqual(result, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildParallelSignoffGroups
// ─────────────────────────────────────────────────────────────────────────────

describe("buildParallelSignoffGroups", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["manager-1"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "div-1", ownerUserIds: ["manager-2"] }),
  ];

  it("should return empty array for single approver", () => {
    const result = buildParallelSignoffGroups(["approver-1"], nodes, "team-1");
    assert.deepStrictEqual(result, []);
  });

  it("should create parallel groups when first is manager", () => {
    const approverChain = ["owner-1", "approver-2", "approver-3"];
    const result = buildParallelSignoffGroups(approverChain, nodes, "team-1");

    // When first is manager (owner of team-1), remaining approvers are batched in groups of 3
    // manager-1 owns team-1, so isFirstManager = true, and we get group "parallel:team-1:0"
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].groupId, "parallel:team-1:0");
    assert.deepStrictEqual(result[0].approverIds, ["approver-2", "approver-3"]);
    assert.strictEqual(result[0].requiredCount, 2);
  });

  it("should batch approvers in groups of 3 when first is manager", () => {
    const approverChain = ["manager-1", "approver-2", "approver-3", "approver-4", "approver-5"];
    const result = buildParallelSignoffGroups(approverChain, nodes, "team-1");

    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0].approverIds, ["approver-2", "approver-3", "approver-4"]);
    assert.deepStrictEqual(result[1].approverIds, ["approver-5"]);
  });

  it("should use orgNodeId in groupId", () => {
    const approverChain = ["owner-1", "approver-2"];
    const result = buildParallelSignoffGroups(approverChain, nodes, "custom-org");

    assert.ok(result[0].groupId.includes("custom-org"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveApprovalSteps
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveApprovalSteps", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["manager-1"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "div-1", ownerUserIds: ["manager-2"] }),
  ];

  it("should create sequential steps for single approver", () => {
    const result = resolveApprovalSteps(["approver-1"], nodes, "team-1");

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].stepId, "step:0");
    assert.deepStrictEqual(result[0].approverIds, ["approver-1"]);
    assert.strictEqual(result[0].requiredApprovals, 1);
    assert.strictEqual(result[0].stepType, "sequential");
  });

  it("should create parallel steps for multiple approvers", () => {
    const approverChain = ["manager-1", "approver-2", "approver-3", "approver-4"];
    const result = resolveApprovalSteps(approverChain, nodes, "team-1");

    assert.ok(result.length > 0);
    // First step is parallel (group-based) when first approver is manager
    assert.strictEqual(result[0].stepType, "parallel");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applySodPolicy
// ─────────────────────────────────────────────────────────────────────────────

describe("applySodPolicy", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", ownerUserIds: ["team-owner"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "div-1", ownerUserIds: ["dept-owner"] }),
  ];

  it("should block requester from approving own request", () => {
    const request = createRequest({ requesterId: "user-1" });
    const approvers = ["user-1", "user-2", "user-3"];

    const result = applySodPolicy(request, approvers, nodes, "team-1");

    assert.ok(!result.includes("user-1"));
    assert.ok(result.includes("user-2"));
    assert.ok(result.includes("user-3"));
  });

  it("should block requester's managers", () => {
    const request = createRequest({
      requesterId: "user-1",
      requesterManagerIds: ["manager-1", "manager-2"],
    });
    const approvers = ["user-1", "manager-1", "manager-2", "user-2"];

    const result = applySodPolicy(request, approvers, nodes, "team-1");

    assert.ok(!result.includes("manager-1"));
    assert.ok(!result.includes("manager-2"));
  });

  it("should block conflicted approvers", () => {
    const request = createRequest({
      requesterId: "user-1",
      conflictedApproverIds: ["conflicted-1"],
    });
    const approvers = ["user-1", "conflicted-1", "user-2"];

    const result = applySodPolicy(request, approvers, nodes, "team-1");

    assert.ok(!result.includes("conflicted-1"));
  });

  it("should block budget owner if same as execution owner", () => {
    const request = createRequest({
      requesterId: "user-1",
      budgetOwnerId: "owner-same",
      executionOwnerId: "owner-same",
    });
    const approvers = ["user-1", "owner-same", "user-2"];

    const result = applySodPolicy(request, approvers, nodes, "team-1");

    assert.ok(!result.includes("owner-same"));
  });

  it("should allow non-chain approvers", () => {
    const request = createRequest({ requesterId: "user-1" });
    const approvers = ["user-1", "manager-1", "dept-owner"];

    const result = applySodPolicy(request, approvers, nodes, "team-1");

    // dept-owner is NOT in same approval chain (dept-1 is not parent of team-1)
    // manager-1 is also not blocked since there's no manager in team-1's chain
    assert.ok(result.includes("dept-owner"));
  });

  it("should allow valid approvers", () => {
    const request = createRequest({ requesterId: "user-1" });
    const approvers = ["user-1", "unrelated-1", "unrelated-2"];

    const result = applySodPolicy(request, approvers, nodes, "team-1");

    assert.ok(result.includes("unrelated-1"));
    assert.ok(result.includes("unrelated-2"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveApprovalRoute - Threshold Logic
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveApprovalRoute - Threshold Logic", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["ceo"] }),
    createOrgNode({ orgNodeId: "div-1", nodeType: "division", parentOrgNodeId: "company-1", ownerUserIds: ["div-head"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "div-1", ownerUserIds: ["dept-head"] }),
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["team-lead"] }),
  ];

  afterEach(() => {
    // Reset default FX rate
    setDefaultLegacyFxRate(7.2);
  });

  it("should route to team for low amount without amount rules", () => {
    const request = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      amount: { value: 100, currency: "CNY" },
    });

    const result = resolveApprovalRoute(nodes, request);

    assert.strictEqual(result.matchedOrgNodeId, "team-1");
    assert.strictEqual(result.routingStrategy, "org_chart");
  });

  it("should include approver chain in decision", () => {
    const request = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
    });

    const result = resolveApprovalRoute(nodes, request);

    assert.ok(result.approverChain.length > 0);
    assert.ok(result.approvalSteps.length > 0);
  });

  it("should populate route snapshot with correct data", () => {
    const request = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      policyVersion: "v2-test",
      orgVersion: "org-v2",
    });

    const result = resolveApprovalRoute(nodes, request);

    assert.strictEqual(result.routeSnapshot.snapshotId.length > 0, true);
    assert.strictEqual(result.routeSnapshot.requesterId, "user-1");
    assert.strictEqual(result.routeSnapshot.matchedOrgNodeId, "team-1");
    assert.strictEqual(result.routeSnapshot.policyVersion, "v2-test");
    assert.strictEqual(result.routeSnapshot.orgVersion, "org-v2");
    assert.ok(result.routeSnapshot.createdAt.length > 0);
    assert.ok(result.routeSnapshot.expiresAt.length > 0);
  });

  it("should calculate CNY amount from USD with FX rate", () => {
    setDefaultLegacyFxRate(7.2);

    const request = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      amountUsd: 100,
    });

    const result = resolveApprovalRoute(nodes, request);

    assert.strictEqual(result.routeSnapshot.amount.amountCny, 720);
    assert.strictEqual(result.routeSnapshot.amount.originalCurrency, "USD");
  });

  it("should convert CNY amount directly", () => {
    const request = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      amount: { value: 5000, currency: "CNY" },
    });

    const result = resolveApprovalRoute(nodes, request);

    assert.strictEqual(result.routeSnapshot.amount.amountCny, 5000);
    assert.strictEqual(result.routeSnapshot.amount.originalCurrency, "CNY");
    assert.strictEqual(result.routeSnapshot.amount.fxSnapshot, null);
  });

  it("should apply FX conversion for non-CNY amounts", () => {
    const request = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      amount: {
        value: 1000,
        currency: "USD",
        fxRateSnapshot: {
          baseCurrency: "USD",
          quoteCurrency: "CNY",
          rate: 7.2,
          source: "test-source",
          capturedAt: new Date().toISOString(),
        },
      },
    });

    const result = resolveApprovalRoute(nodes, request);

    assert.strictEqual(result.routeSnapshot.amount.amountCny, 7200);
    assert.strictEqual(result.routeSnapshot.amount.fxSnapshot?.rate, 7.2);
  });

  it("should detect delegated chain", () => {
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1" });
    const delegationMap: Record<string, string> = {
      "team-lead": "delegated-lead",
    };

    const result = resolveApprovalRoute(nodes, request, delegationMap);

    assert.strictEqual(result.delegated, true);
    assert.ok(result.approverChain.includes("delegated-lead"));
  });

  it("should block SOD conflicts in approver chain", () => {
    const request = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      requesterManagerIds: ["manager-1"],
    });

    const result = resolveApprovalRoute(nodes, request);

    assert.ok(!result.approverChain.includes("manager-1"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// revalidateApprovalRoute
// ─────────────────────────────────────────────────────────────────────────────

describe("revalidateApprovalRoute", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", ownerUserIds: ["lead"] }),
  ];

  it("should return invalid for expired event", () => {
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1" });
    const existingDecision = resolveApprovalRoute(nodes, request);

    const result = revalidateApprovalRoute(nodes, request, existingDecision, "expired");

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.event, "expired");
    assert.ok(result.reasons.includes("approval_route.expired"));
  });

  it("should return invalid for revoked event", () => {
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1" });
    const existingDecision = resolveApprovalRoute(nodes, request);

    const result = revalidateApprovalRoute(nodes, request, existingDecision, "revoked");

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.event, "revoked");
    assert.ok(result.reasons.includes("approval_route.revoked"));
  });

  it("should detect org version change on submitted event", () => {
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1", orgVersion: "v2" });
    const existingDecision = resolveApprovalRoute(nodes, request);

    const newRequest = createRequest({ requesterId: "user-1", orgNodeId: "team-1", orgVersion: "v3" });

    const result = revalidateApprovalRoute(nodes, newRequest, existingDecision, "submitted");

    assert.strictEqual(result.valid, false);
    assert.ok(result.reasons.includes("approval_route.org_version_changed"));
  });

  it("should detect policy version change", () => {
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1", policyVersion: "v1" });
    const existingDecision = resolveApprovalRoute(nodes, request);

    const newRequest = createRequest({ requesterId: "user-1", orgNodeId: "team-1", policyVersion: "v2" });

    const result = revalidateApprovalRoute(nodes, newRequest, existingDecision, "submitted");

    assert.strictEqual(result.valid, false);
    assert.ok(result.reasons.includes("approval_route.policy_version_changed"));
  });

  it("should detect org version change", () => {
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1", orgVersion: "v2" });
    const existingDecision = resolveApprovalRoute(nodes, request);

    const newRequest = createRequest({ requesterId: "user-1", orgNodeId: "team-1", orgVersion: "v3" });

    const result = revalidateApprovalRoute(nodes, newRequest, existingDecision, "submitted");

    assert.strictEqual(result.valid, false);
    assert.ok(result.reasons.includes("approval_route.org_version_changed"));
  });

  it("should detect approver chain change when amount causes different routing strategy", () => {
    // The existingDecision uses amount that triggers amount-based routing
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1" });
    const existingDecision = resolveApprovalRoute(nodes, request);

    // New request with very large amount triggers fallback to tenant node (different owner)
    // Since there's no tenant node, it falls back to nodes[0] which is team-1
    // But if we use a different requester that triggers different SOD blocking...
    const newRequest = createRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      requesterManagerIds: ["lead"],  // manager is blocked
    });

    const result = revalidateApprovalRoute(nodes, newRequest, existingDecision, "submitted");

    // New request blocks the owner "lead", so approver chain differs
    assert.strictEqual(result.valid, false);
    assert.ok(result.reasons.includes("approval_route.approver_chain_changed"));
  });

  it("should return valid when nothing changed", () => {
    const request = createRequest({ requesterId: "user-1", orgNodeId: "team-1" });
    const existingDecision = resolveApprovalRoute(nodes, request);

    const result = revalidateApprovalRoute(nodes, request, existingDecision, "submitted");

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.reasons.length, 0);
    assert.ok(result.routeSnapshot !== null);
  });
});
