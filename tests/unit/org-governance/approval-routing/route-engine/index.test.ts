import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalRouteRequestSchema,
  OrgChartRoutingStrategy,
  AmountBasedRoutingStrategy,
  resolveAmountRoute,
  applySodPolicy,
  resolveApprovalRoute,
  revalidateApprovalRoute,
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
  assert.equal(request.amountUsd, undefined);
  assert.equal(request.policyVersion, "approval-routing/v2");
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
    { maxAmountCny: 1000, targetNodeTypes: ["team"] },
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
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
    amount: { value: 500, currency: "CNY" },
  });
  const selected = strategy.selectNode(nodes, request);
  assert.ok(selected != null);
  assert.equal(selected?.nodeType, "team");
});

test("resolveAmountRoute returns company node when no rules match", () => {
  const rules: readonly AmountThresholdRule[] = [
    { maxAmountCny: 100, targetNodeTypes: ["team"] },
  ];
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["admin"] },
    { orgNodeId: "n1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "n1",
    riskLevel: "medium",
    amount: { value: 10000, currency: "CNY" },
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
  const filtered = applySodPolicy(ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "n1",
    riskLevel: "low",
    requesterManagerIds: ["user-3"],
    conflictedApproverIds: ["user-2"],
  }), approvers, nodes, "n1");
  assert.ok(!filtered.includes("user-1"));
  assert.ok(!filtered.includes("user-2"));
  assert.ok(!filtered.includes("user-3"));
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
  assert.equal(decision.routeSnapshot.orgVersion, "org-chart/v2");
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
  assert.ok(decision.routeSnapshot.approverIds.includes("delegate1"));
});

test("ApprovalRouteDecision type is usable", () => {
  const decision: ApprovalRouteDecision = {
    matchedOrgNodeId: "node-1",
    approverChain: ["user-1"],
    delegated: false,
    routingStrategy: "org_chart",
    routeSnapshot: {
      snapshotId: "snapshot-1",
      createdAt: "1970-01-01T00:00:00.000Z",
      orgVersion: "org-chart/v2",
      policyVersion: "approval-routing/v2",
      requesterId: "requester-1",
      matchedOrgNodeId: "node-1",
      routingStrategy: "org_chart",
      approverIds: ["user-1"],
      amount: {
        originalValue: 0,
        originalCurrency: "USD",
        amountCny: 0,
        fxSnapshot: null,
      },
      evidenceRefs: [],
      sodSnapshot: {
        requesterManagerIds: [],
        blockedApproverIds: [],
        budgetOwnerId: null,
        executionOwnerId: "requester-1",
      },
      coiSnapshot: {
        conflictedApproverIds: [],
        blockedApproverIds: [],
      },
      legalEntityApprovalRoles: [],
    },
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

test("resolveApprovalRoute freezes FX and evidence snapshot", () => {
  const nodes = [
    { orgNodeId: "team-1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"], legalEntityBoundary: { boundaryId: "le-1", legalEntityId: "entity-1", jurisdictionCountry: "CN", dataResidencyRegion: "cn-sh", crossBorderTransferPolicy: "approval_required", crossEntityApprovalRoles: ["legal_reviewer"], restrictedDataClasses: [] } },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "team-1",
    riskLevel: "high",
    amount: {
      value: 100,
      currency: "USD",
      fxRateSnapshot: {
        baseCurrency: "USD",
        quoteCurrency: "CNY",
        rate: 7.1,
        source: "treasury",
        capturedAt: "2026-04-28T00:00:00.000Z",
      },
    },
    evidenceRefs: ["evidence://fx", "evidence://sod"],
  });
  const decision = resolveApprovalRoute(nodes, request);

  assert.equal(decision.routeSnapshot.amount.amountCny, 710);
  assert.equal(decision.routeSnapshot.amount.fxSnapshot?.source, "treasury");
  assert.deepEqual(decision.routeSnapshot.evidenceRefs, ["evidence://fx", "evidence://sod"]);
});

test("revalidateApprovalRoute invalidates expired and changed routes", () => {
  const nodes = [
    { orgNodeId: "team-1", nodeType: "team" as const, active: true, ownerUserIds: ["owner1"] },
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "team-1",
    riskLevel: "low",
  });
  const decision = resolveApprovalRoute(nodes, request);

  const expired = revalidateApprovalRoute(nodes, request, decision, "expired");
  assert.equal(expired.valid, false);

  const changed = revalidateApprovalRoute(
    [{ orgNodeId: "team-1", nodeType: "team" as const, active: true, ownerUserIds: ["owner2"] }],
    ApprovalRouteRequestSchema.parse({ ...request, orgVersion: "org-chart/v3" }),
    decision,
    "submitted",
  );
  assert.equal(changed.valid, false);
  assert.ok(changed.reasons.includes("approval_route.org_version_changed"));
});
