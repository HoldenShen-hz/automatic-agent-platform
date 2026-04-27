import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalRouteRequestSchema,
  OrgChartRoutingStrategy,
  AmountBasedRoutingStrategy,
  resolveAmountRoute,
  applySodPolicy,
  resolveApprovalRoute,
  type ApprovalRouteDecision,
  type AmountThresholdRule,
  type RoutingStrategy,
} from "../../../../../src/org-governance/approval-routing/route-engine/index.js";

test("ApprovalRouteRequestSchema parses valid request", () => {
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "node-1",
    riskLevel: "medium",
    amountUsd: 1000,
  });
  assert.equal(request.requesterId, "user-1");
  assert.equal(request.riskLevel, "medium");
  assert.equal(request.amountUsd, 1000);
});

test("ApprovalRouteRequestSchema uses default for amountUsd", () => {
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "node-1",
    riskLevel: "low",
  });
  assert.equal(request.amountUsd, 0);
});

test("ApprovalRouteRequestSchema rejects invalid riskLevel", () => {
  assert.throws(() => ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "node-1",
    riskLevel: "invalid",
  }));
});

test("OrgChartRoutingStrategy selects active node", () => {
  const strategy = new OrgChartRoutingStrategy();
  const nodes = [
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "n1",
    riskLevel: "low",
  });
  const selected = strategy.selectNode(nodes, request);
  assert.ok(selected != null);
  assert.equal(selected?.orgNodeId, "n1");
});

test("OrgChartRoutingStrategy returns first node when no match", () => {
  const strategy = new OrgChartRoutingStrategy();
  const nodes = [
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "nonexistent",
    riskLevel: "low",
  });
  const selected = strategy.selectNode(nodes, request);
  assert.ok(selected != null);
  assert.equal(selected?.orgNodeId, "n1");
});

test("AmountBasedRoutingStrategy uses threshold rules", () => {
  const rules: readonly AmountThresholdRule[] = [
    { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
    { maxAmountUsd: 10000, targetNodeTypes: ["department"] },
  ];
  const strategy = new AmountBasedRoutingStrategy(rules);
  const nodes = [
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
    { orgNodeId: "n2", nodeType: "department" as const, active: true, ownerUserIds: ["owner2"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "n1",
    riskLevel: "low",
    amountUsd: 500,
  });
  const selected = strategy.selectNode(nodes, request);
  assert.ok(selected != null);
  assert.equal(selected?.nodeType, "team");
});

test("resolveAmountRoute returns company node when no rules match", () => {
  const rules: readonly AmountThresholdRule[] = [
    { maxAmountUsd: 100, targetNodeTypes: ["team"] },
  ];
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["admin"] },
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "n1",
    riskLevel: "medium",
    amountUsd: 10000,
  });
  const selected = resolveAmountRoute(nodes, request, rules);
  assert.ok(selected != null);
  assert.equal(selected?.nodeType, "company");
});

test("applySodPolicy filters initiator from approvers", () => {
  const nodes = [
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["user-1", "user-2"] },
  ];
  const approvers = ["user-1", "user-2", "user-3"];
  const filtered = applySodPolicy("user-1", approvers, nodes, "n1");
  assert.ok(!filtered.includes("user-1"));
  assert.ok(filtered.includes("user-2"));
  assert.ok(filtered.includes("user-3"));
});

test("resolveApprovalRoute creates decision with org_chart strategy", () => {
  const nodes = [
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "n1",
    riskLevel: "low",
    amountUsd: 0,
  });
  const decision = resolveApprovalRoute(nodes, request);
  assert.equal(decision.matchedOrgNodeId, "n1");
  assert.ok(decision.approverChain.length > 0);
  assert.equal(decision.routingStrategy, "org_chart");
});

test("resolveApprovalRoute includes delegation mapping", () => {
  const nodes = [
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "n1",
    riskLevel: "low",
  });
  const delegationMap: Record<string, string> = { owner1: "delegate1" };
  const decision = resolveApprovalRoute(nodes, request, delegationMap);
  assert.equal(decision.delegated, true);
  assert.ok(decision.approverChain.includes("delegate1"));
});

test("ApprovalRouteDecision type is usable", () => {
  const decision: ApprovalRouteDecision = {
    matchedOrgNodeId: "node-1",
    approverChain: ["user-1"],
    delegated: false,
    routingStrategy: "org_chart",
  };
  assert.equal(decision.matchedOrgNodeId, "node-1");
  assert.equal(decision.routingStrategy, "org_chart");
});

test("AmountThresholdRule type is usable", () => {
  const rule: AmountThresholdRule = {
    maxAmountUsd: 5000,
    targetNodeTypes: ["team", "department"],
  };
  assert.equal(rule.maxAmountUsd, 5000);
  assert.equal(rule.targetNodeTypes.length, 2);
});

test("RoutingStrategy type is usable", () => {
  const strategy: RoutingStrategy = new OrgChartRoutingStrategy();
  assert.equal(strategy.strategyId, "org_chart");
});