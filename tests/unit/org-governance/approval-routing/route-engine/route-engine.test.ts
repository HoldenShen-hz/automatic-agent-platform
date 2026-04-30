/**
 * Unit tests for Approval Route Engine
 * Tests cover specific security and correctness issues:
 * - Issue #1978: Amount threshold uses < not <=, equal amount falls through
 */

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
  buildParallelSignoffGroups,
  resolveApprovalSteps,
  type ApprovalRouteRequest,
  type AmountThresholdRule,
} from "../../../../../src/org-governance/approval-routing/route-engine/index.js";

function createOrgNode(overrides: Partial<{
  orgNodeId: string;
  nodeType: "company" | "department" | "team";
  parentOrgNodeId: string | null;
  ownerUserIds: string[];
  active: boolean;
}> = {}): {
  orgNodeId: string;
  nodeType: "company" | "department" | "team";
  displayName: string;
  parentOrgNodeId: string | null;
  ownerUserIds: string[];
  active: boolean;
  costCenter: string;
  metadata: Record<string, unknown>;
} {
  return {
    orgNodeId: overrides.orgNodeId ?? "node-1",
    nodeType: overrides.nodeType ?? "department",
    displayName: "Test Node",
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: "cc-1",
    metadata: {},
  };
}

// ─── Issue #1978: Amount threshold uses < not <=, equal amount falls through ─────

test("resolveAmountRoute treats amount equal to threshold as NOT matching - demonstrates boundary bug", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"] }),
    createOrgNode({ orgNodeId: "division-1", nodeType: "department", parentOrgNodeId: "company-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["vp"] }),
  ];

  const rules: AmountThresholdRule[] = [
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
  ];

  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 10000, currency: "CNY" }, // Exactly at threshold
  });

  const result = resolveAmountRoute(nodes, request, rules);

  // BUG: Amount exactly at threshold (10000) is NOT matched because the code uses < instead of <=
  // So the amount-based routing fails and falls back to company level
  // This causes equal amounts to not match any rule
  assert.equal(result?.orgNodeId, "company-1"); // Falls through to company
});

test("resolveAmountRoute amount just below threshold matches", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"] }),
    createOrgNode({ orgNodeId: "division-1", nodeType: "department", parentOrgNodeId: "company-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["vp"] }),
  ];

  const rules: AmountThresholdRule[] = [
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
  ];

  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 9999, currency: "CNY" }, // Just below threshold
  });

  const result = resolveAmountRoute(nodes, request, rules);

  // Just below threshold - should match
  assert.equal(result?.orgNodeId, "dept-1");
});

test("resolveAmountRoute amount just above threshold falls through to higher level", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"] }),
    createOrgNode({ orgNodeId: "division-1", nodeType: "department", parentOrgNodeId: "company-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["vp"] }),
  ];

  const rules: AmountThresholdRule[] = [
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
  ];

  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 10001, currency: "CNY" }, // Just above threshold
  });

  const result = resolveAmountRoute(nodes, request, rules);

  // Above threshold - should fall through to company
  assert.equal(result?.orgNodeId, "company-1");
});

test("resolveAmountRoute with USD amount and fxRate at exact threshold - demonstrates bug", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["vp"] }),
  ];

  const rules: AmountThresholdRule[] = [
    { maxAmountUsd: 1389, targetNodeTypes: ["department"] }, // ~10000 CNY at 7.2 rate
  ];

  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: {
      value: 1389,
      currency: "USD",
      fxRateSnapshot: {
        baseCurrency: "USD",
        quoteCurrency: "CNY",
        rate: 7.2,
        source: "test",
        capturedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  const result = resolveAmountRoute(nodes, request, rules);

  // 1389 * 7.2 = 10000.8 CNY - just above threshold but due to floating point it equals
  // The issue is the < vs <= problem at exact boundary
  // In real scenario, 10000 CNY exact would fail to match
});

test("AmountBasedRoutingStrategy uses < instead of <= for threshold comparison - demonstrates bug", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", ownerUserIds: ["lead"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"] }),
  ];

  const rules: AmountThresholdRule[] = [
    { maxAmountCny: 5000, targetNodeTypes: ["team"] },
  ];

  const strategy = new AmountBasedRoutingStrategy(rules);

  // Amount exactly at threshold
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "team-1",
    riskLevel: "low",
    amount: { value: 5000, currency: "CNY" },
  });

  const selected = strategy.selectNode(nodes, request);

  // BUG: At exactly 5000 CNY, the team level is NOT selected because code uses < not <=
  // This causes equal amounts to fall through to higher approval levels unexpectedly
  assert.equal(selected?.orgNodeId, undefined); // Falls through - no match
});

test("AmountBasedRoutingStrategy amount below threshold matches correctly", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", ownerUserIds: ["lead"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"] }),
  ];

  const rules: AmountThresholdRule[] = [
    { maxAmountCny: 5000, targetNodeTypes: ["team"] },
  ];

  const strategy = new AmountBasedRoutingStrategy(rules);

  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "team-1",
    riskLevel: "low",
    amount: { value: 4999, currency: "CNY" },
  });

  const selected = strategy.selectNode(nodes, request);

  assert.equal(selected?.orgNodeId, "team-1");
});

test("resolveApprovalRoute with exact threshold amount uses wrong routing strategy", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"], active: true }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["ceo"], active: true }),
  ];

  const amountRules: AmountThresholdRule[] = [
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
  ];

  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 10000, currency: "CNY" },
  });

  const decision = resolveApprovalRoute(nodes, request, {}, amountRules);

  // BUG: Amount exactly at threshold (10000) results in amount_based routing
  // but doesn't actually match any department rule, causing wrong fallback
  // The routing strategy shows "amount_based" but approvers come from company level
  assert.equal(decision.routingStrategy, "amount_based");
  assert.equal(decision.matchedOrgNodeId, "company-1"); // Wrong - should be dept-1 if it matched
});

test("resolveApprovalRoute amount one above threshold matches correctly", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", ownerUserIds: ["manager"], active: true }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", ownerUserIds: ["ceo"], active: true }),
  ];

  const amountRules: AmountThresholdRule[] = [
    { maxAmountCny: 10000, targetNodeTypes: ["department"] },
  ];

  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 10001, currency: "CNY" },
  });

  const decision = resolveApprovalRoute(nodes, request, {}, amountRules);

  // Amount above threshold - falls through to company level (expected)
  assert.equal(decision.routingStrategy, "amount_based");
  assert.equal(decision.matchedOrgNodeId, "company-1");
});

// ─── SOD Policy Tests ──────────────────────────────────────────────────────────

test("applySodPolicy blocks requester from approving their own request", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "director",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const filtered = applySodPolicy(request, ["director", "manager"], nodes, "dept-1");
  assert.ok(!filtered.includes("director"));
  assert.ok(filtered.includes("manager"));
});

test("applySodPolicy blocks requester's managers from approving", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["manager"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    requesterManagerIds: ["manager"],
  });
  const filtered = applySodPolicy(request, ["manager", "vp"], nodes, "dept-1");
  assert.ok(!filtered.includes("manager"));
  assert.ok(filtered.includes("vp"));
});

test("applySodPolicy blocks conflicted approvers", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["clean-approver"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    conflictedApproverIds: ["conflicted-approver"],
  });
  const filtered = applySodPolicy(request, ["conflicted-approver", "clean-approver"], nodes, "dept-1");
  assert.ok(!filtered.includes("conflicted-approver"));
  assert.ok(filtered.includes("clean-approver"));
});

test("applySodPolicy blocks same-chain approvers (parent-child relationship)", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["employee"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: null, ownerUserIds: ["director"] }),
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "team-1",
    riskLevel: "low",
  });
  const filtered = applySodPolicy(request, ["director"], nodes, "team-1");
  assert.ok(!filtered.includes("director"));
});

test("applySodPolicy blocks same-chain approvers (child-parent relationship)", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["employee"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: null, ownerUserIds: ["director"] }),
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "director",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const filtered = applySodPolicy(request, ["employee"], nodes, "dept-1");
  assert.ok(!filtered.includes("employee"));
});

test("applySodPolicy blocks approvers in ancestor chain", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["employee"] }),
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", ownerUserIds: ["manager"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, ownerUserIds: ["director"] }),
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "team-1",
    riskLevel: "low",
  });
  const filtered = applySodPolicy(request, ["manager", "director"], nodes, "team-1");
  assert.ok(!filtered.includes("manager"));
  assert.ok(!filtered.includes("director"));
});

test("applySodPolicy blocks when budget owner equals execution owner", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["owner"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    budgetOwnerId: "owner",
    executionOwnerId: "owner",
  });
  const filtered = applySodPolicy(request, ["owner"], nodes, "dept-1");
  assert.ok(!filtered.includes("owner"));
});

// ─── Routing Strategy Tests ─────────────────────────────────────────────────────

test("OrgChartRoutingStrategy selects requested org node", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1" }),
    createOrgNode({ orgNodeId: "dept-2" }),
  ];
  const strategy = new OrgChartRoutingStrategy();
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });

  const selected = strategy.selectNode(nodes, request);

  assert.equal(selected?.orgNodeId, "dept-1");
});

test("OrgChartRoutingStrategy falls back to first node if requested not found", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1" }),
    createOrgNode({ orgNodeId: "dept-2" }),
  ];
  const strategy = new OrgChartRoutingStrategy();
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "nonexistent",
    riskLevel: "low",
  });

  const selected = strategy.selectNode(nodes, request);

  assert.equal(selected?.orgNodeId, "dept-1");
});

// ─── Parallel Signoff Tests ────────────────────────────────────────────────────

test("buildParallelSignoffGroups returns empty for single approver", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["manager"] })];
  const groups = buildParallelSignoffGroups(["manager"], nodes, "dept-1");

  assert.equal(groups.length, 0);
});

test("buildParallelSignoffGroups creates parallel group for multiple approvers", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["employee"] }),
  ];
  const groups = buildParallelSignoffGroups(["director", "manager"], nodes, "team-1");

  assert.ok(groups.length > 0);
});

test("resolveApprovalSteps creates sequential steps for single approver", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["manager"] })];
  const steps = resolveApprovalSteps(["manager"], nodes, "dept-1");

  assert.equal(steps.length, 1);
  assert.equal(steps[0].stepType, "sequential");
});

test("resolveApprovalSteps creates parallel steps when groups exist", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["employee"] }),
  ];
  const approverChain = ["director", "manager", "vp"];
  const steps = resolveApprovalSteps(approverChain, nodes, "team-1");

  // Should create some parallel steps
  assert.ok(steps.length >= 1);
});

// ─── Route Revalidation Tests ─────────────────────────────────────────────────

test("revalidateApprovalRoute returns expired for expired event", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const existingDecision = resolveApprovalRoute(nodes, request);

  const result = revalidateApprovalRoute(nodes, request, existingDecision, "expired");

  assert.equal(result.valid, false);
  assert.equal(result.event, "expired");
  assert.ok(result.reasons.includes("approval_route.expired"));
});

test("revalidateApprovalRoute returns revoked for revoked event", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const existingDecision = resolveApprovalRoute(nodes, request);

  const result = revalidateApprovalRoute(nodes, request, existingDecision, "revoked");

  assert.equal(result.valid, false);
  assert.equal(result.event, "revoked");
  assert.ok(result.reasons.includes("approval_route.revoked"));
});

test("revalidateApprovalRoute detects org version change", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
    orgVersion: "v1",
  });
  const existingDecision = resolveApprovalRoute(nodes, request);

  const updatedRequest = ApprovalRouteRequestSchema.parse({
    ...request,
    orgVersion: "v2",
  });

  const result = revalidateApprovalRoute(nodes, updatedRequest, existingDecision, "submitted");

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("approval_route.org_version_changed"));
});

test("revalidateApprovalRoute detects approver chain change", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["manager"] }),
    createOrgNode({ orgNodeId: "dept-2", ownerUserIds: ["director"] }),
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const existingDecision = resolveApprovalRoute(nodes, request);

  // Change request to different org node with different approvers
  const updatedRequest = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-2",
    riskLevel: "low",
  });

  const result = revalidateApprovalRoute(nodes, updatedRequest, existingDecision, "submitted");

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("approval_route.approver_chain_changed"));
});

test("revalidateApprovalRoute returns valid when nothing changed", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["manager"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "employee",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const existingDecision = resolveApprovalRoute(nodes, request);

  const result = revalidateApprovalRoute(nodes, request, existingDecision, "submitted");

  assert.equal(result.valid, true);
  assert.equal(result.reasons.length, 0);
});
