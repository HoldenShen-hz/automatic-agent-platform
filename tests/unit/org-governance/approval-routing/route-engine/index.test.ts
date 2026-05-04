/**
 * Unit tests for Approval Route Engine
 * Covers: SOD policy same-chain prevention (R3-24), parallel sign-off support (R9-33),
 * exchange rate handling (R9-34), ApprovalRouteSnapshot.expiresAt (R9-35)
 */

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

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
  setDefaultLegacyFxRate,
  type ApprovalRouteDecision,
  type AmountThresholdRule,
  type ApprovalRouteSnapshot,
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

beforeEach(() => {
  setDefaultLegacyFxRate(7.2);
});

afterEach(() => {
  setDefaultLegacyFxRate(null);
});

// R3-24: SOD policy same-chain prevention

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
  // requester is in team-1, approver is the director of dept-1 (parent of team-1)
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
  // director is blocked because employee (requester) is in team-1 and director owns dept-1 (parent)
  assert.ok(!filtered.includes("director"));
});

test("applySodPolicy blocks same-chain approvers (child-parent relationship)", () => {
  // requester is director of dept-1, approver is employee in team-1 (child of dept-1)
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
  // employee is blocked because director (requester) owns dept-1 and employee is in team-1 (child)
  assert.ok(!filtered.includes("employee"));
});

test("applySodPolicy blocks approvers in ancestor chain", () => {
  // employee -> manager -> director (ancestor chain)
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

// R9-33: Parallel sign-off support

test("buildParallelSignoffGroups returns empty for single approver chain", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const groups = buildParallelSignoffGroups(["director"], nodes, "dept-1");
  assert.deepStrictEqual(groups, []);
});

test("buildParallelSignoffGroups creates single group for two approvers when first is manager", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["manager"] }),
  ];
  // chain: first=manager (is manager), remaining=[second]
  const groups = buildParallelSignoffGroups(["manager", "second"], nodes, "dept-1");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].groupId, "parallel:dept-1:0");
  assert.deepStrictEqual(groups[0].approverIds, ["second"]);
});

test("buildParallelSignoffGroups creates single group when first is not manager", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: null, ownerUserIds: ["director"] }),
  ];
  // Matching the current org node also counts as a manager-level first approver.
  const groups = buildParallelSignoffGroups(["director", "second", "third"], nodes, "dept-1");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].groupId, "parallel:dept-1:0");
  assert.deepStrictEqual(groups[0].approverIds, ["second", "third"]);
});

test("buildParallelSignoffGroups batches remaining approvers in groups of 3", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["manager"] }),
  ];
  const groups = buildParallelSignoffGroups(["manager", "a", "b", "c", "d", "e"], nodes, "dept-1");
  assert.equal(groups.length, 2);
  assert.deepStrictEqual(groups[0].approverIds, ["a", "b", "c"]);
  assert.deepStrictEqual(groups[1].approverIds, ["d", "e"]);
});

test("resolveApprovalSteps creates sequential steps for single approver", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const steps = resolveApprovalSteps(["director"], nodes, "dept-1");
  assert.equal(steps.length, 1);
  assert.equal(steps[0].stepType, "sequential");
  assert.deepStrictEqual(steps[0].approverIds, ["director"]);
  assert.equal(steps[0].requiredApprovals, 1);
});

test("resolveApprovalSteps creates parallel steps for multiple approvers", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["manager"] }),
  ];
  const steps = resolveApprovalSteps(["manager", "a", "b", "c"], nodes, "dept-1");
  assert.ok(steps.length >= 1);
  const parallelStep = steps.find(s => s.stepType === "parallel");
  assert.ok(parallelStep != null);
  assert.ok(parallelStep.approverIds.length > 1);
});

test("resolveApprovalSteps sequential steps have correct dependencies", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: null, ownerUserIds: ["director"] }),
  ];
  const steps = resolveApprovalSteps(["director", "second", "third"], nodes, "dept-1");
  // When first is not manager, all remaining go to parallel group
  const parallelStep = steps.find(s => s.stepType === "parallel");
  assert.ok(parallelStep != null);
  // parallel step depends on previous step
  if (steps.length > 1) {
    assert.ok(parallelStep.dependsOnSteps != null);
  }
});

// R9-34: Exchange rate handling

test("normalizeApprovalAmount uses configured legacy FX rate for amountUsd compatibility", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  }));
  // Legacy USD uses default rate of 7.2
  assert.equal(decision.routeSnapshot.amount.amountCny, 720);
  assert.equal(decision.routeSnapshot.amount.originalCurrency, "USD");
  assert.equal(decision.routeSnapshot.amount.fxSnapshot?.rate, 7.2);
  assert.equal(decision.routeSnapshot.amount.fxSnapshot?.source, "configured_legacy_fx_rate");
});

test("normalizeApprovalAmount rejects legacy amountUsd when no legacy FX rate is configured", () => {
  setDefaultLegacyFxRate(null);
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  assert.throws(() => resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  })), { message: /approval_route\.fx_snapshot_required:USD/ });
});

test("normalizeApprovalAmount handles CNY amount directly", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 1000, currency: "CNY" },
  }));
  assert.equal(decision.routeSnapshot.amount.amountCny, 1000);
  assert.equal(decision.routeSnapshot.amount.originalCurrency, "CNY");
  assert.equal(decision.routeSnapshot.amount.fxSnapshot, null);
});

test("normalizeApprovalAmount applies FX rate for non-CNY currency", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
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
  }));
  assert.equal(decision.routeSnapshot.amount.amountCny, 710);
  assert.equal(decision.routeSnapshot.amount.originalValue, 100);
  assert.equal(decision.routeSnapshot.amount.fxSnapshot?.rate, 7.1);
  assert.equal(decision.routeSnapshot.amount.fxSnapshot?.source, "treasury");
});

test("normalizeApprovalAmount throws when FX snapshot missing for non-CNY", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  assert.throws(() => resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 100, currency: "EUR" },
  })), { message: /approval_route.fx_snapshot_required/ });
});

test("normalizeThresholdCny uses maxAmountCny directly", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  // AmountBasedRoutingStrategy internally uses normalizeThresholdCny
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountCny: 5000, targetNodeTypes: ["department"] },
  ]);
  const selected = strategy.selectNode(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 4000, currency: "CNY" },
  }));
  assert.ok(selected != null);
  assert.equal(selected.orgNodeId, "dept-1");
});

test("normalizeThresholdCny requires FX snapshot when USD thresholds are applied to non-USD request amounts", () => {
  setDefaultLegacyFxRate(null);
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true, ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", active: true, ownerUserIds: ["admin"] }),
  ];
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 1000, targetNodeTypes: ["department"] },
  ]);
  assert.throws(() => strategy.selectNode(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: { value: 5000, currency: "CNY" },
  })), { message: /approval_route.fx_snapshot_required/ });
});

test("normalizeThresholdCny uses provided FX snapshot for USD conversion", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true, ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", nodeType: "company", active: true, ownerUserIds: ["admin"] }),
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: {
      value: 500,
      currency: "USD",
      fxRateSnapshot: {
        baseCurrency: "USD",
        quoteCurrency: "CNY",
        rate: 7.0,
        source: "treasury",
        capturedAt: "2026-04-28T00:00:00.000Z",
      },
    },
  });
  // maxAmountUsd = 100, so threshold = 100 * 7.0 = 700 CNY
  // 500 USD * 7.0 = 3500 CNY > 700, so should fall back to company
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 100, targetNodeTypes: ["department"] },
  ]);
  const selected = strategy.selectNode(nodes, request);
  assert.ok(selected != null);
  assert.equal(selected.nodeType, "company");
});

// R9-35: ApprovalRouteSnapshot.expiresAt

test("ApprovalRouteSnapshot.expiresAt is set to createdAt plus 24 hours", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const before = new Date().toISOString();
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amountUsd: 100,
  }));
  const after = new Date().toISOString();

  const createdAt = new Date(decision.routeSnapshot.createdAt);
  const expiresAt = new Date(decision.routeSnapshot.expiresAt);
  const diffMs = expiresAt.getTime() - createdAt.getTime();

  assert.equal(diffMs, 24 * 60 * 60 * 1000);
});

test("ApprovalRouteSnapshot.expiresAt uses fxSnapshot.capturedAt when available", () => {
  const capturedAt = "2026-04-28T10:00:00.000Z";
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    amount: {
      value: 100,
      currency: "USD",
      fxRateSnapshot: {
        baseCurrency: "USD",
        quoteCurrency: "CNY",
        rate: 7.1,
        source: "treasury",
        capturedAt,
      },
    },
  }));

  const expiresAt = new Date(decision.routeSnapshot.expiresAt);
  const fxCapturedAt = new Date(capturedAt);
  const diffMs = expiresAt.getTime() - fxCapturedAt.getTime();

  assert.equal(diffMs, 24 * 60 * 60 * 1000);
  assert.equal(decision.routeSnapshot.createdAt, capturedAt);
});

test("ApprovalRouteSnapshot has correct structure with all required fields", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "high",
    amountUsd: 5000,
    requesterManagerIds: ["manager"],
    conflictedApproverIds: ["conflicted"],
    evidenceRefs: ["evidence-1"],
  }));

  const snapshot = decision.routeSnapshot;
  assert.ok(snapshot.snapshotId.includes("approval_route_snapshot"));
  assert.ok(snapshot.createdAt != null);
  assert.ok(snapshot.expiresAt != null);
  assert.equal(snapshot.orgVersion, "org-chart/v2");
  assert.equal(snapshot.policyVersion, "approval-routing/v2");
  assert.equal(snapshot.requesterId, "user-1");
  assert.equal(snapshot.matchedOrgNodeId, "dept-1");
  assert.equal(snapshot.routingStrategy, "org_chart");
  assert.ok(Array.isArray(snapshot.approverIds));
  assert.ok(snapshot.sodSnapshot != null);
  assert.ok(snapshot.coiSnapshot != null);
  assert.ok(Array.isArray(snapshot.legalEntityApprovalRoles));
});

// Additional coverage for edge cases

test("resolveApprovalRoute defaults to platform_admin when no owners", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: [] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
  }));
  assert.deepStrictEqual(decision.approverChain, ["platform_admin"]);
});

test("AmountBasedRoutingStrategy falls back to first active node when orgNodeId not in parent-child", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", nodeType: "department", active: true, ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "team-1", nodeType: "team", active: true, ownerUserIds: ["lead"] }),
  ];
  const strategy = new AmountBasedRoutingStrategy([
    { maxAmountUsd: 5000, targetNodeTypes: ["team"] },
  ]);
  const selected = strategy.selectNode(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "team-1",
    riskLevel: "low",
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
  }));
  assert.ok(selected != null);
  assert.equal(selected.orgNodeId, "team-1");
});

test("resolveApprovalRoute creates SOD snapshot with correct fields", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    requesterManagerIds: ["manager"],
    budgetOwnerId: "budget-owner",
    executionOwnerId: "exec-owner",
    conflictedApproverIds: ["conflicted-1"],
  }));

  const sod = decision.routeSnapshot.sodSnapshot;
  assert.deepStrictEqual(sod.requesterManagerIds, ["manager"]);
  assert.equal(sod.budgetOwnerId, "budget-owner");
  assert.equal(sod.executionOwnerId, "exec-owner");
  assert.ok(Array.isArray(sod.blockedApproverIds));
});

test("resolveApprovalRoute creates COI snapshot with correct fields", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const decision = resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
    conflictedApproverIds: ["conflicted-1", "conflicted-2"],
  }));

  const coi = decision.routeSnapshot.coiSnapshot;
  assert.deepStrictEqual(coi.conflictedApproverIds, ["conflicted-1", "conflicted-2"]);
  assert.ok(Array.isArray(coi.blockedApproverIds));
});

test("revalidateApprovalRoute returns invalid for expired event", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const decision = resolveApprovalRoute(nodes, request);

  const result = revalidateApprovalRoute(nodes, request, decision, "expired");

  assert.equal(result.valid, false);
  assert.equal(result.event, "expired");
  assert.ok(result.reasons.includes("approval_route.expired"));
  assert.equal(result.routeSnapshot, null);
});

test("revalidateApprovalRoute returns invalid for revoked event", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const decision = resolveApprovalRoute(nodes, request);

  const result = revalidateApprovalRoute(nodes, request, decision, "revoked");

  assert.equal(result.valid, false);
  assert.equal(result.event, "revoked");
  assert.ok(result.reasons.includes("approval_route.revoked"));
  assert.equal(result.routeSnapshot, null);
});

test("revalidateApprovalRoute detects org version change", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const decision = resolveApprovalRoute(nodes, request);

  const changedRequest = { ...request, orgVersion: "org-chart/v3" };
  const result = revalidateApprovalRoute(nodes, changedRequest, decision, "submitted");

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("approval_route.org_version_changed"));
});

test("revalidateApprovalRoute detects approver chain change", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["lead"] }),
  ];
  const request = ApprovalRouteRequestSchema.parse({
    requesterId: "user-1",
    orgNodeId: "dept-1",
    riskLevel: "low",
  });
  const decision = resolveApprovalRoute(nodes, request);

  // Change the org structure so approver chain changes
  const changedNodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["new-director"] }),
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["lead"] }),
  ];
  const result = revalidateApprovalRoute(changedNodes, request, decision, "submitted");

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("approval_route.approver_chain_changed"));
});
