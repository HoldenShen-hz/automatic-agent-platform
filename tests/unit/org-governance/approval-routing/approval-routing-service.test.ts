import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalRoutingService } from "../../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";
import type { ApprovalRouteRequest } from "../../../../src/org-governance/approval-routing/route-engine/index.js";
import type { ApprovalDelegation } from "../../../../src/org-governance/approval-routing/delegation/index.js";
import type { ApprovalEscalationRule } from "../../../../src/org-governance/approval-routing/escalation/index.js";
import type { AmountThresholdRule } from "../../../../src/org-governance/approval-routing/route-engine/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeOrgNode(overrides: Partial<OrgNode> & { orgNodeId: string; nodeType: OrgNode["nodeType"] }): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId,
    nodeType: overrides.nodeType,
    displayName: overrides.displayName ?? `Node ${overrides.orgNodeId}`,
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
    legalEntityBoundary: overrides.legalEntityBoundary ?? null,
  };
}

function makeRequest(overrides: Partial<ApprovalRouteRequest> = {}): ApprovalRouteRequest {
  return {
    requesterId: "requester_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    requesterManagerIds: [],
    conflictedApproverIds: [],
    evidenceRefs: [],
    policyVersion: "approval-routing/v2",
    orgVersion: "org-chart/v2",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// route() — happy path
// ─────────────────────────────────────────────────────────────────────────────

test("route() returns direct route when no delegation or escalation", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const result = service.route(
    makeRequest({ requesterId: "user_1", orgNodeId: "dept_1" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.equal(result.matchedOrgNodeId, "dept_1");
  assert.deepEqual(result.approverChain, ["dir_1"]);
  assert.equal(result.delegated, false);
  assert.equal(result.escalatedTo, null);
  assert.equal(result.routingStrategy, "org_chart");
  assert.ok(result.auditRecord.reasonCodes.includes("approval.direct_route"));
  assert.equal(result.auditRecord.action, "approval.route");
  assert.equal(result.auditRecord.actorId, "user_1");
});

test("route() applies active in-scope delegation", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const delegations: ApprovalDelegation[] = [
    {
      delegationId: "del_1",
      approverId: "dir_1",
      delegateApproverId: "backup_dir",
      delegationType: "manager_cover",
      scopeNodeIds: ["dept_1"],
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
      active: true,
      conflictOfInterestApproverIds: [],
      coiReviewStatus: "passed",
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });

  const result = service.route(
    makeRequest({ requesterId: "user_1" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.deepEqual(result.approverChain, ["backup_dir"]);
  assert.equal(result.delegated, true);
  assert.ok(result.auditRecord.reasonCodes.includes("approval.delegated"));
});

test("route() skips inactive delegation", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const delegations: ApprovalDelegation[] = [
    {
      delegationId: "del_1",
      approverId: "dir_1",
      delegateApproverId: "backup_dir",
      delegationType: "manager_cover",
      scopeNodeIds: ["dept_1"],
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
      active: false,
      conflictOfInterestApproverIds: [],
      coiReviewStatus: "passed",
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });

  const result = service.route(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.deepEqual(result.approverChain, ["dir_1"]);
  assert.equal(result.delegated, false);
});

test("route() skips expired delegation", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const delegations: ApprovalDelegation[] = [
    {
      delegationId: "del_1",
      approverId: "dir_1",
      delegateApproverId: "backup_dir",
      delegationType: "manager_cover",
      scopeNodeIds: ["dept_1"],
      startsAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2025-12-31T00:00:00.000Z",
      active: true,
      conflictOfInterestApproverIds: [],
      coiReviewStatus: "passed",
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });

  const result = service.route(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.deepEqual(result.approverChain, ["dir_1"]);
  assert.equal(result.delegated, false);
});

test("route() skips delegation outside scope", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const delegations: ApprovalDelegation[] = [
    {
      delegationId: "del_1",
      approverId: "dir_1",
      delegateApproverId: "backup_dir",
      delegationType: "manager_cover",
      scopeNodeIds: ["other_dept"],
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
      active: true,
      conflictOfInterestApproverIds: [],
      coiReviewStatus: "passed",
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });

  const result = service.route(
    makeRequest({ orgNodeId: "dept_1" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.deepEqual(result.approverChain, ["dir_1"]);
  assert.equal(result.delegated, false);
});

test("route() rejects delegation with failed COI status", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const delegations: ApprovalDelegation[] = [
    {
      delegationId: "del_1",
      approverId: "dir_1",
      delegateApproverId: "backup_dir",
      delegationType: "manager_cover",
      scopeNodeIds: ["dept_1"],
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
      active: true,
      conflictOfInterestApproverIds: [],
      coiReviewStatus: "failed",
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });

  const result = service.route(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.deepEqual(result.approverChain, ["dir_1"]);
  assert.equal(result.delegated, false);
});

test("route() applies escalation when time threshold exceeded", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const rules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc_1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp_ops",
      appliesToRiskLevels: ["high", "critical"],
      escalateToParentManager: false,
      escalationLevel: 1,
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: rules });

  // 60 minutes later — threshold exceeded
  const result = service.route(
    makeRequest({ riskLevel: "high" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T01:00:00.000Z",
  );

  assert.ok(result.approverChain.includes("vp_ops"));
  assert.equal(result.escalatedTo, "vp_ops");
  assert.ok(result.auditRecord.reasonCodes.includes("approval.escalated"));
});

test("route() does not escalate when time threshold not met", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const rules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc_1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp_ops",
      appliesToRiskLevels: ["high", "critical"],
      escalateToParentManager: false,
      escalationLevel: 1,
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: rules });

  // only 15 minutes
  const result = service.route(
    makeRequest({ riskLevel: "high" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:15:00.000Z",
  );

  assert.equal(result.escalatedTo, null);
  assert.ok(!result.auditRecord.reasonCodes.includes("approval.escalated"));
});

test("route() does not escalate when risk level not in appliesToRiskLevels", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const rules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc_1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp_ops",
      appliesToRiskLevels: ["high", "critical"],
      escalateToParentManager: false,
      escalationLevel: 1,
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: rules });

  const result = service.route(
    makeRequest({ riskLevel: "low" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T02:00:00.000Z",
  );

  assert.equal(result.escalatedTo, null);
});

test("route() prepends escalated approver in sequential chain", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const rules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc_1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp_ops",
      appliesToRiskLevels: ["high", "critical"],
      escalateToParentManager: false,
      escalationLevel: 1,
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: rules });

  const result = service.route(
    makeRequest({ riskLevel: "high" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T01:00:00.000Z",
  );

  // escalation is prepended so vp_ops approves BEFORE dir_1
  assert.deepEqual(result.approverChain, ["vp_ops", "dir_1"]);
});

test("route() does not duplicate escalated approver if already in chain", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["vp_ops"] }),
  ];
  const rules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc_1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp_ops",
      appliesToRiskLevels: ["high", "critical"],
      escalateToParentManager: false,
      escalationLevel: 1,
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: rules });

  const result = service.route(
    makeRequest({ riskLevel: "high" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T01:00:00.000Z",
  );

  // vp_ops is already in chain so no prepending/dedup needed; escalatedTo still set
  assert.deepEqual(result.approverChain, ["vp_ops"]);
  assert.equal(result.escalatedTo, "vp_ops");
});

test("route() applies delegation and escalation together", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const delegations: ApprovalDelegation[] = [
    {
      delegationId: "del_1",
      approverId: "dir_1",
      delegateApproverId: "backup_dir",
      delegationType: "manager_cover",
      scopeNodeIds: ["dept_1"],
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
      active: true,
      conflictOfInterestApproverIds: [],
      coiReviewStatus: "passed",
    },
  ];
  const rules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc_1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp_ops",
      appliesToRiskLevels: ["high", "critical"],
      escalateToParentManager: false,
      escalationLevel: 1,
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations, escalationRules: rules });

  const result = service.route(
    makeRequest({ riskLevel: "high" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T01:00:00.000Z",
  );

  assert.deepEqual(result.approverChain, ["vp_ops", "backup_dir"]);
  assert.equal(result.delegated, true);
  assert.equal(result.escalatedTo, "vp_ops");
});

test("route() filters requester from approver chain (SoD policy)", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  // requester is the same as the approver
  const result = service.route(
    makeRequest({ requesterId: "dir_1" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.ok(!result.approverChain.includes("dir_1"));
});

test("route() falls back to platform_admin when node has no owners", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "empty_dept", nodeType: "department", ownerUserIds: [] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const result = service.route(
    makeRequest({ orgNodeId: "empty_dept" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.deepEqual(result.approverChain, ["platform_admin"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// route() — amount threshold rules
// ─────────────────────────────────────────────────────────────────────────────

test("route() uses amount-based routing when threshold rules provided", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dept_owner"] }),
  ];
  // Use maxAmountCny to avoid FX rate requirement in threshold normalization
  const rules: AmountThresholdRule[] = [
    { maxAmountCny: 50000, targetNodeTypes: ["department"] },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, amountThresholdRules: rules });

  const result = service.route(
    makeRequest({ amount: { currency: "CNY", value: 5000 }, orgNodeId: "dept_1" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.equal(result.routingStrategy, "amount_based");
});

// ─────────────────────────────────────────────────────────────────────────────
// route() — error / edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("route() handles missing orgNode by returning first node", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "first", nodeType: "company", ownerUserIds: ["admin"] }),
    makeOrgNode({ orgNodeId: "second", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const result = service.route(
    makeRequest({ orgNodeId: "nonexistent" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.equal(result.matchedOrgNodeId, "first");
});

test("route() returns valid auditRecord with unique recordId", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const result1 = service.route(makeRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
  const result2 = service.route(makeRequest(), "2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");

  assert.ok(result1.auditRecord.recordId.startsWith("audit_"));
  assert.ok(result2.auditRecord.recordId.startsWith("audit_"));
  assert.notEqual(result1.auditRecord.recordId, result2.auditRecord.recordId);
});

// ─────────────────────────────────────────────────────────────────────────────
// getAmountThresholdMatrix()
// ─────────────────────────────────────────────────────────────────────────────

test("getAmountThresholdMatrix() returns empty array by default", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const matrix = service.getAmountThresholdMatrix();

  assert.deepEqual(matrix, []);
});

test("getAmountThresholdMatrix() returns configured rules", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const rules: AmountThresholdRule[] = [
    { maxAmountUsd: 1000, targetNodeTypes: ["department"] },
    { maxAmountCny: 5000, targetNodeTypes: ["team"] },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, amountThresholdRules: rules });

  const matrix = service.getAmountThresholdMatrix();

  assert.equal(matrix.length, 2);
  assert.equal(matrix[0]?.maxAmountUsd, 1000);
  assert.equal(matrix[1]?.maxAmountCny, 5000);
});

// ─────────────────────────────────────────────────────────────────────────────
// planChain() — happy path
// ─────────────────────────────────────────────────────────────────────────────

test("planChain() creates sequential chain by default", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.equal(plan.chainMode, "sequential");
  assert.equal(plan.matchedOrgNodeId, "dept_1");
  assert.ok(plan.steps.length > 0);
  assert.equal(plan.steps[0]?.mode, "sequential");
  assert.equal(plan.steps[0]?.deadlineAt, null);
});

test("planChain() creates parallel chain when chainMode=parallel", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
    makeOrgNode({ orgNodeId: "team_1", nodeType: "team", parentOrgNodeId: "dept_1", ownerUserIds: ["tm"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest({ orgNodeId: "team_1" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
    { chainMode: "parallel" },
  );

  assert.equal(plan.chainMode, "parallel");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.mode, "parallel");
});

test("planChain() creates conditional chain with extra approvers", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["security_team"] },
  );

  assert.equal(plan.chainMode, "conditional");
  assert.ok(plan.steps.some((s) => s.approverIds.includes("security_team")));
});

test("planChain() applies timeoutMinutes as deadline", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
    { timeoutMinutes: 60 },
  );

  assert.ok(plan.steps[0]?.deadlineAt != null);
  const deadline = new Date(plan.steps[0]!.deadlineAt!);
  assert.equal(deadline.toISOString(), "2026-04-01T01:00:00.000Z");
});

test("planChain() null deadline when no timeoutMinutes", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.equal(plan.steps[0]?.deadlineAt, null);
});

test("planChain() sets escalationTarget on steps", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const rules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc_1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp_ops",
      appliesToRiskLevels: ["high", "critical"],
      escalateToParentManager: false,
      escalationLevel: 1,
    },
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: rules });

  const plan = service.planChain(
    makeRequest({ riskLevel: "high" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T01:00:00.000Z",
  );

  assert.equal(plan.steps[0]?.escalationTarget, "vp_ops");
});

test("planChain() generates unique stepIds", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  const stepIds = plan.steps.map((s) => s.stepId);
  assert.equal(new Set(stepIds).size, stepIds.length, "All stepIds must be unique");
});

test("planChain() filters empty strings from conditionalApproverIds", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["valid", "", "also_valid"] },
  );

  assert.equal(plan.chainMode, "conditional");
  const allIds = plan.steps.flatMap((s) => s.approverIds);
  assert.ok(!allIds.includes(""));
});

test("planChain() uses reasonCodes from auditRecord", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.ok(plan.steps[0]?.reasonCodes.length > 0);
});

test("planChain() conditional mode adds conditional routing reasonCode", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["security_team"] },
  );

  const conditionalStep = plan.steps.find((s) => s.approverIds.includes("security_team"));
  assert.ok(conditionalStep?.reasonCodes.includes("approval.routing.conditional"));
});

// ─────────────────────────────────────────────────────────────────────────────
// planChain() — error / edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("planChain() handles empty orgNodes", () => {
  const service = new ApprovalRoutingService({ orgNodes: [] });

  const plan = service.planChain(
    makeRequest({ orgNodeId: "nonexistent" }),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.ok(plan.matchedOrgNodeId != null);
  assert.ok(Array.isArray(plan.steps));
});

test("planChain() works with no escalation or delegation", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({
    orgNodes: nodes,
    delegations: [],
    escalationRules: [],
    amountThresholdRules: [],
  });

  const plan = service.planChain(
    makeRequest(),
    "2026-04-01T00:00:00.000Z",
    "2026-04-01T00:00:00.000Z",
  );

  assert.equal(plan.chainMode, "sequential");
  assert.ok(plan.steps.length > 0);
  assert.equal(plan.steps[0]?.escalationTarget, null);
});

test("planChain() works with all chain modes explicitly", () => {
  const nodes: OrgNode[] = [
    makeOrgNode({ orgNodeId: "dept_1", nodeType: "department", ownerUserIds: ["dir_1"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const modes: Array<"sequential" | "parallel" | "conditional"> = ["sequential", "parallel", "conditional"];

  for (const mode of modes) {
    const plan = service.planChain(
      makeRequest(),
      "2026-04-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
      { chainMode: mode },
    );
    assert.equal(plan.chainMode, mode, `chainMode ${mode} should be preserved`);
  }
});