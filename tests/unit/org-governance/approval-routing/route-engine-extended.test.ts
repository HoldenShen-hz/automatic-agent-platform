/**
 * Unit tests for Approval Route Engine - additional coverage
 *
 * @see src/org-governance/approval-routing/route-engine/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";
import {
  OrgChartRoutingStrategy,
  AmountBasedRoutingStrategy,
  resolveAmountRoute,
  applySodPolicy,
  resolveApprovalRoute,
  ApprovalRouteRequestSchema,
  type AmountThresholdRule,
} from "../../../../src/org-governance/approval-routing/route-engine/index.js";

function createOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
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

test("ApprovalRouteRequestSchema parses valid request", () => {
  const request = {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "high",
    amountUsd: 5000,
  };
  const result = ApprovalRouteRequestSchema.safeParse(request);
  assert.equal(result.success, true);
});

test("ApprovalRouteRequestSchema requires requesterId", () => {
  const request = {
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  };
  const result = ApprovalRouteRequestSchema.safeParse(request);
  assert.equal(result.success, false);
});

test("ApprovalRouteRequestSchema requires non-empty requesterId", () => {
  const request = {
    requesterId: "",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  };
  const result = ApprovalRouteRequestSchema.safeParse(request);
  assert.equal(result.success, false);
});

test("ApprovalRouteRequestSchema accepts all valid risk levels", () => {
  const levels = ["low", "medium", "high", "critical"];
  for (const level of levels) {
    const result = ApprovalRouteRequestSchema.safeParse({
      requesterId: "user-1",
      orgNodeId: "dept-1",
      riskLevel: level,
      amountUsd: 100,
    });
    assert.equal(result.success, true, `riskLevel ${level} should be valid`);
  }
});

test("ApprovalRouteRequestSchema rejects invalid risk level", () => {
  const result = ApprovalRouteRequestSchema.safeParse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "extreme",
    amountUsd: 100,
  });
  assert.equal(result.success, false);
});

test("ApprovalRouteRequestSchema leaves amountUsd undefined when omitted", () => {
  const result = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  assert.equal(result.amountUsd, undefined);
});

test("ApprovalRouteRequestSchema rejects negative amountUsd", () => {
  const result = ApprovalRouteRequestSchema.safeParse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: -100,
  });
  assert.equal(result.success, false);
});

test("OrgChartRoutingStrategy.selectNode returns first active match", () => {
  const strategy = new OrgChartRoutingStrategy();
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", active: true, ownerUserIds: ["owner1"] }),
    createOrgNode({ orgNodeId: "dept-2", active: true, ownerUserIds: ["owner2"] }),
  ];
  const request = {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low" as const,
    amountUsd: 0,
  };

  const result = strategy.selectNode(nodes, request);

  assert.equal(result?.orgNodeId, "dept-1");
});

test("OrgChartRoutingStrategy.selectNode returns null when orgNodeId not found", () => {
  const strategy = new OrgChartRoutingStrategy();
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", active: true }),
    createOrgNode({ orgNodeId: "dept-2", active: true }),
  ];
  const request = {
    requesterId: "user-1",
    orgNodeId: "nonexistent",
    riskLevel: "low" as const,
    amountUsd: 0,
  };

  const result = strategy.selectNode(nodes, request);

  assert.equal(result, null);
});

test("OrgChartRoutingStrategy.selectNode returns null for empty nodes array", () => {
  const strategy = new OrgChartRoutingStrategy();
  const request = {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low" as const,
    amountUsd: 0,
  };

  const result = strategy.selectNode([], request);

  assert.equal(result, null);
});

test("AmountBasedRoutingStrategy selects node based on amount threshold", () => {
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
    { maxAmountUsd: 5000, targetNodeTypes: ["department"] },
  ]);
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true }),
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", active: true }),
  ];
  const request = {
    requesterId: "user-1",
    orgNodeId: "team-1",
    riskLevel: "medium" as const,
    amountUsd: 3000,
  };

  const result = strategy.selectNode(nodes, request);

  assert.equal(result?.nodeType, "department");
});

test("AmountBasedRoutingStrategy falls back to company when no rule matches", () => {
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 500, targetNodeTypes: ["team"] },
  ]);
  const nodes = [
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", active: true }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true }),
  ];
  const request = {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "critical" as const,
    amountUsd: 100000,
  };

  const result = strategy.selectNode(nodes, request);

  assert.equal(result?.orgNodeId, "company-1");
});

test("resolveAmountRoute returns null when nodes array is empty", () => {
  const rules: AmountThresholdRule[] = [
    { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
  ];

  const result = resolveAmountRoute([], {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 500,
  }, rules);

  assert.equal(result, null);
});

test("resolveAmountRoute selects company when amount exceeds all thresholds", () => {
  const rules: AmountThresholdRule[] = [
    { maxAmountUsd: 500, targetNodeTypes: ["team"] },
    { maxAmountUsd: 2000, targetNodeTypes: ["department"] },
  ];
  const nodes = [
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", active: true }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true }),
  ];

  const result = resolveAmountRoute(nodes, {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "high",
    amountUsd: 10000,
  }, rules);

  assert.equal(result?.orgNodeId, "company-1");
});

test("applySodPolicy filters out initiator from approver list", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director", "manager"] }),
  ];

  const result = applySodPolicy(ApprovalRouteRequestSchema.parse({
    requesterId: "director",
    orgNodeId: "dept-1",
    riskLevel: "low",
  }), ["director", "manager"], nodes, "dept-1");

  assert.deepStrictEqual(result, []);
});

test("applySodPolicy returns all approvers when initiator not in list", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["manager"] }),
  ];

  const result = applySodPolicy(ApprovalRouteRequestSchema.parse({
    requesterId: "director",
    orgNodeId: "dept-1",
    riskLevel: "low",
  }), ["manager", "vp"], nodes, "dept-1");

  assert.deepStrictEqual(result, ["manager", "vp"]);
});

test("applySodPolicy returns empty array when all approvers filtered", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] }),
  ];

  const result = applySodPolicy(ApprovalRouteRequestSchema.parse({
    requesterId: "director",
    orgNodeId: "dept-1",
    riskLevel: "low",
  }), ["director"], nodes, "dept-1");

  assert.deepStrictEqual(result, []);
});

test("resolveApprovalRoute includes correct routingStrategy in result", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];

  const result = resolveApprovalRoute(nodes, {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  });

  assert.equal(result.routingStrategy, "org_chart");
});

test("resolveApprovalRoute with amount rules uses amount_based strategy", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];

  const result = resolveApprovalRoute(nodes, {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  }, {}, [{ maxAmountUsd: 5000, targetNodeTypes: ["department"] }]);

  assert.equal(result.routingStrategy, "amount_based");
});

test("resolveApprovalRoute handles delegation map correctly", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];

  const result = resolveApprovalRoute(nodes, {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  }, { director: "backup-director" });

  assert.deepStrictEqual(result.approverChain, ["backup-director"]);
  assert.equal(result.delegated, true);
});

test("resolveApprovalRoute uses platform_admin when no owners", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: [] })];

  const result = resolveApprovalRoute(nodes, {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  });

  assert.deepStrictEqual(result.approverChain, ["platform_admin"]);
});

test("AmountBasedRoutingStrategy returns null when no matching node found", () => {
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
  ]);
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true }),
  ];
  const request = {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low" as const,
    amountUsd: 500,
  };

  const result = strategy.selectNode(nodes, request);

  assert.equal(result, null);
});

test("resolveAmountRoute respects active flag", () => {
  const rules: AmountThresholdRule[] = [
    { maxAmountUsd: 5000, targetNodeTypes: ["department"] },
  ];
  const nodes = [
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", active: true }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: false }),
  ];

  const result = resolveAmountRoute(nodes, {
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "medium",
    amountUsd: 1000,
  }, rules);

  assert.equal(result, null);
});

test("AmountBasedRoutingStrategy strategyId is amount_based", () => {
  const strategy = new AmountBasedRoutingStrategy([]);

  assert.equal(strategy.strategyId, "amount_based");
});

test("OrgChartRoutingStrategy strategyId is org_chart", () => {
  const strategy = new OrgChartRoutingStrategy();

  assert.equal(strategy.strategyId, "org_chart");
});
