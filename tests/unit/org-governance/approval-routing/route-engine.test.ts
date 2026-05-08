import assert from "node:assert/strict";
import test from "node:test";

import {
  AmountBasedRoutingStrategy,
  OrgChartRoutingStrategy,
  resolveApprovalRoute,
} from "../../../../src/org-governance/approval-routing/route-engine/index.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";

const nodes: OrgNode[] = [
  {
    orgNodeId: "team-1",
    nodeType: "team",
    displayName: "Team 1",
    parentOrgNodeId: "dept-1",
    ownerUserIds: ["lead"],
    active: true,
    costCenter: "cc-1",
    metadata: {},
  },
  {
    orgNodeId: "dept-1",
    nodeType: "department",
    displayName: "Dept 1",
    parentOrgNodeId: null,
    ownerUserIds: ["director"],
    active: true,
    costCenter: "cc-2",
    metadata: {},
  },
];

test("AmountBasedRoutingStrategy selects higher-level approver node", () => {
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 500, targetNodeTypes: ["team"] },
    { maxAmountUsd: 5000, targetNodeTypes: ["department"] },
  ]);

  const selected = strategy.selectNode(nodes, {
    requesterId: "user-1",
    orgNodeId: "team-1",
    riskLevel: "medium",
    amountUsd: 1000,
  });

  assert.equal(selected?.orgNodeId, "dept-1");
});

test("resolveApprovalRoute falls back to org chart strategy when amount strategy does not match", () => {
  const result = resolveApprovalRoute(
    nodes,
    {
      requesterId: "user-1",
      orgNodeId: "team-1",
      riskLevel: "low",
      amountUsd: 100,
    },
    {},
    [],
  );

  assert.equal(result.routingStrategy, new OrgChartRoutingStrategy().strategyId);
  assert.equal(result.matchedOrgNodeId, "team-1");
});
