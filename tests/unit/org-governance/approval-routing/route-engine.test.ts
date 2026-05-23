import assert from "node:assert/strict";
import test from "node:test";

import {
  AmountBasedRoutingStrategy,
  OrgChartRoutingStrategy,
  resolveApprovalRoute,
} from "../../../../src/org-governance/approval-routing/route-engine/index.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";

function createOrgNode(overrides: Partial<OrgNode> & { orgNodeId: string; nodeType: OrgNode["nodeType"] }): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId,
    nodeType: overrides.nodeType,
    displayName: overrides.displayName ?? overrides.orgNodeId,
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
    effectivePolicies: overrides.effectivePolicies ?? {},
    status: overrides.status ?? (overrides.active ?? true ? "active" : "inactive"),
  };
}

function createApprovalRequest(overrides: {
  requesterId: string;
  orgNodeId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  amountUsd?: number;
}) {
  return {
    requesterId: overrides.requesterId,
    orgNodeId: overrides.orgNodeId,
    riskLevel: overrides.riskLevel,
    requesterManagerIds: [],
    conflictedApproverIds: [],
    policyVersion: "approval-routing/v2",
    orgVersion: "org-chart/v2",
    evidenceRefs: [],
    ...(overrides.amountUsd != null ? { amountUsd: overrides.amountUsd } : {}),
  };
}

const nodes: OrgNode[] = [
  createOrgNode({
    orgNodeId: "team-1",
    nodeType: "team",
    displayName: "Team 1",
    parentOrgNodeId: "dept-1",
    ownerUserIds: ["lead"],
    costCenter: "cc-1",
  }),
  createOrgNode({
    orgNodeId: "dept-1",
    nodeType: "department",
    displayName: "Dept 1",
    ownerUserIds: ["director"],
    costCenter: "cc-2",
  }),
];

test("AmountBasedRoutingStrategy selects higher-level approver node", () => {
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 500, targetNodeTypes: ["team"] },
    { maxAmountUsd: 5000, targetNodeTypes: ["department"] },
  ]);

  const selected = strategy.selectNode(nodes, createApprovalRequest({
    requesterId: "user-1",
    orgNodeId: "team-1",
    riskLevel: "medium",
    amountUsd: 1000,
  }));

  assert.equal(selected?.orgNodeId, "dept-1");
});

test("resolveApprovalRoute falls back to org chart strategy when amount strategy does not match", () => {
  const result = resolveApprovalRoute(
    nodes,
    createApprovalRequest({
      requesterId: "user-1",
      orgNodeId: "team-1",
      riskLevel: "low",
      amountUsd: 100,
    }),
    {},
    [],
  );

  assert.equal(result.routingStrategy, new OrgChartRoutingStrategy().strategyId);
  assert.equal(result.matchedOrgNodeId, "team-1");
});
