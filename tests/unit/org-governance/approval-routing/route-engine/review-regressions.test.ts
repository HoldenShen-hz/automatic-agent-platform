import assert from "node:assert/strict";
import test from "node:test";

import type { OrgNode } from "../../../../../src/org-governance/org-model/org-node/index.js";
import {
  AmountBasedRoutingStrategy,
  ApprovalRouteRequestSchema,
  resolveApprovalRoute,
} from "../../../../../src/org-governance/approval-routing/route-engine/index.js";

function createOrgNode(overrides: Partial<OrgNode> & { orgNodeId: string; nodeType?: OrgNode["nodeType"] }): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId,
    nodeType: overrides.nodeType ?? "department",
    displayName: overrides.displayName ?? overrides.orgNodeId,
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? ["owner-1"],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "cc-1",
    metadata: overrides.metadata ?? {},
    legalEntityBoundary: overrides.legalEntityBoundary ?? null,
  };
}

test("resolveApprovalRoute uses current time instead of epoch when fx snapshot is absent", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const before = Date.now();
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 120,
  }));
  const after = Date.now();
  const createdAt = Date.parse(decision.routeSnapshot.createdAt);

  assert.ok(Number.isFinite(createdAt));
  assert.ok(createdAt >= before);
  assert.ok(createdAt <= after);
  assert.notEqual(decision.routeSnapshot.createdAt, new Date(0).toISOString());
});

test("AmountBasedRoutingStrategy uses provided fx snapshot instead of legacy default rate", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["director-1"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["admin-1"] }),
  ];
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 100, targetNodeTypes: ["department"] },
  ]);

  const selected = strategy.selectNode(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: {
      value: 95,
      currency: "USD",
      fxRateSnapshot: {
        baseCurrency: "USD",
        quoteCurrency: "CNY",
        rate: 8,
        source: "treasury",
        capturedAt: "2026-05-01T00:00:00.000Z",
      },
    },
  }));

  assert.ok(selected != null);
  assert.equal(selected.orgNodeId, "dept-1");
});
