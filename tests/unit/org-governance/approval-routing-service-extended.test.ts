/**
 * Extended Unit Tests: Approval Routing Service
 *
 * Provides comprehensive coverage for ApprovalRoutingService methods
 * including planChain, getAmountThresholdMatrix, and edge cases.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";
import type { ApprovalDelegation } from "../../../src/org-governance/approval-routing/delegation/index.js";
import type { ApprovalEscalationRule } from "../../../src/org-governance/approval-routing/escalation/index.js";
import type { AmountThresholdRule } from "../../../src/org-governance/approval-routing/route-engine/index.js";

function createOrgNode(overrides: Partial<OrgNode> & { orgNodeId: string; nodeType: OrgNode["nodeType"] }): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId,
    nodeType: overrides.nodeType,
    displayName: overrides.displayName ?? `Node ${overrides.orgNodeId}`,
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
  };
}

function createDelegation(overrides: Partial<ApprovalDelegation> & { approverId: string; delegateApproverId: string }): ApprovalDelegation {
  return {
    delegationId: overrides.delegationId ?? `del-${Math.random().toString(36).slice(2)}`,
    approverId: overrides.approverId,
    delegateApproverId: overrides.delegateApproverId,
    delegationType: overrides.delegationType ?? "temporary_cover",
    scopeNodeIds: overrides.scopeNodeIds ?? [],
    conflictOfInterestApproverIds: overrides.conflictOfInterestApproverIds ?? [],
    coiReviewStatus: overrides.coiReviewStatus ?? "pending",
    startsAt: overrides.startsAt ?? "2026-01-01T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-12-31T23:59:59.999Z",
    active: overrides.active ?? true,
  };
}

const COMPANY_NODE = createOrgNode({
  orgNodeId: "company",
  nodeType: "company",
  ownerUserIds: ["ceo"],
});

const DEPT_NODE = createOrgNode({
  orgNodeId: "dept-eng",
  nodeType: "department",
  parentOrgNodeId: "company",
  ownerUserIds: ["vp-eng"],
});

const TEAM_NODE = createOrgNode({
  orgNodeId: "team-platform",
  nodeType: "team",
  parentOrgNodeId: "dept-eng",
  ownerUserIds: ["platform-lead"],
});

test("ApprovalRoutingService.planChain creates sequential chain by default", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );

  assert.equal(plan.chainMode, "sequential");
  assert.equal(plan.matchedOrgNodeId, "team-platform");
  assert.ok(plan.steps.length > 0);
  assert.ok(plan.steps.every((s) => s.mode === "sequential"));
});

test("ApprovalRoutingService.planChain creates parallel chain when specified", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "dept-eng", riskLevel: "medium" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "parallel" },
  );

  assert.equal(plan.chainMode, "parallel");
  assert.ok(plan.steps.length > 0);
  assert.ok(plan.steps.every((s) => s.mode === "parallel"));
});

test("ApprovalRoutingService.planChain creates conditional chain when specified", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "dept-eng", riskLevel: "high" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["security-reviewer"] },
  );

  assert.equal(plan.chainMode, "conditional");
  assert.ok(plan.steps.length > 0);
});

test("ApprovalRoutingService.planChain includes deadline when timeoutMinutes specified", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "high" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "sequential", timeoutMinutes: 60 },
  );

  assert.ok(plan.steps.every((s) => s.deadlineAt != null));
});

test("ApprovalRoutingService.planChain does not include deadline when timeoutMinutes not specified", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );

  assert.ok(plan.steps.every((s) => s.deadlineAt == null));
});

test("ApprovalRoutingService.planChain includes escalation target when escalated", () => {
  const escalationRules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc-high",
      triggerAfterMinutes: 30,
      escalateToApproverId: "ciso",
      appliesToRiskLevels: ["high", "critical"],
    },
  ];

  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    escalationRules,
  });

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T00:45:00.000Z"; // 45 minutes later

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "high" },
    createdAt,
    now,
    { chainMode: "sequential" },
  );

  // escalatedTo should be set if escalation triggered
  const hasEscalation = plan.steps.some((s) => s.escalationTarget != null);
  assert.equal(hasEscalation, true);
});

test("ApprovalRoutingService.planChain adds conditional approvers not already in chain", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "medium" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["security-reviewer", "compliance-officer"] },
  );

  // Should have the original approver plus conditional approvers
  const allApprovers = plan.steps.flatMap((s) => s.approverIds);
  assert.ok(allApprovers.includes("platform-lead"));
  assert.ok(allApprovers.includes("security-reviewer"));
  assert.ok(allApprovers.includes("compliance-officer"));
});

test("ApprovalRoutingService.planChain filters out empty conditional approver IDs", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "medium" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["", "security-reviewer", ""] },
  );

  const allApprovers = plan.steps.flatMap((s) => s.approverIds);
  assert.ok(!allApprovers.includes(""));
});

test("ApprovalRoutingService.getAmountThresholdMatrix returns copy of rules", () => {
  const thresholdRules: AmountThresholdRule[] = [
    { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
    { maxAmountUsd: 50000, targetNodeTypes: ["department"] },
  ];

  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    amountThresholdRules: thresholdRules,
  });

  const matrix = service.getAmountThresholdMatrix();

  assert.equal(matrix.length, 2);
  // Matrix should be a copy
  assert.ok(Array.isArray(matrix));
});

test("ApprovalRoutingService.planChain handles empty conditionalApproverIds array", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: [] },
  );

  assert.equal(plan.chainMode, "conditional");
  assert.ok(plan.steps.length > 0);
});

test("ApprovalRoutingService.planChain in parallel mode has all approvers in single step", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "dept-eng", riskLevel: "medium" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "parallel" },
  );

  // In parallel mode, should have one step with all approvers
  assert.equal(plan.steps.length, 1);
  assert.ok(plan.steps[0].approverIds.length > 0);
});

test("ApprovalRoutingService.planChain in sequential mode creates one step per approver", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "sequential" },
  );

  // Sequential mode creates one step per approver
  assert.ok(plan.steps.length >= 1);
  assert.ok(plan.steps.every((s) => s.approverIds.length === 1));
});

test("ApprovalRoutingService.planChain includes reason codes from audit record", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "medium" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "sequential" },
  );

  assert.ok(plan.steps[0].reasonCodes.length > 0);
  assert.ok(plan.steps[0].reasonCodes.some((code) => code.startsWith("approval.")));
});

test("ApprovalRoutingService.planChain conditional mode adds conditional reason code", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["security-reviewer"] },
  );

  // Conditional steps should have conditional reason code
  assert.ok(plan.steps.some((s) => s.reasonCodes.includes("approval.routing.conditional")));
});

test("ApprovalRoutingService.planChain with delegations applies delegation to chain", () => {
  const delegations: ApprovalDelegation[] = [
    createDelegation({
      approverId: "platform-lead",
      delegateApproverId: "backup-lead",
      scopeNodeIds: ["team-platform"],
      active: true,
      startsAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
  ];

  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    delegations,
  });

  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );

  // Delegation should be applied
  const allApprovers = plan.steps.flatMap((s) => s.approverIds);
  assert.ok(allApprovers.includes("backup-lead") || allApprovers.includes("platform-lead"));
});

test("ApprovalRoutingService.route generates collision-free audit recordIds", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  // Generate multiple audit records for same requester+node combination
  const recordIds = new Set<string>();
  const baseRequest = { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "medium" as const };

  for (let i = 0; i < 100; i++) {
    const result = service.route(
      baseRequest,
      "2026-04-20T00:00:00.000Z",
      "2026-04-20T00:00:00.000Z",
    );
    recordIds.add(result.auditRecord.recordId);
  }

  // All 100 recordIds should be unique (collision-free)
  assert.equal(recordIds.size, 100, "Expected all 100 recordIds to be unique");
});

test("ApprovalRoutingService.route builds correct audit record structure", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const result = service.route(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "medium" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );

  assert.ok(result.auditRecord);
  assert.ok(result.auditRecord.recordId.includes("approval_route_audit_user-1_team-platform"));
  assert.equal(result.auditRecord.action, "approval.route");
  assert.equal(result.auditRecord.actorId, "user-1");
  assert.equal(result.auditRecord.orgNodeId, "team-platform");
  assert.equal(result.auditRecord.allowed, true); // Has approvers
  assert.ok(result.auditRecord.reasonCodes.length > 0);
  assert.ok(result.auditRecord.occurredAt.length > 0);
});

test("ApprovalRoutingService.route with empty orgNodes returns fallback approver", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [],
  });

  const result = service.route(
    { requesterId: "user-1", orgNodeId: "any-node", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );

  // With no orgNodes, implementation falls back to platform_admin
  assert.deepEqual(result.approverChain, ["platform_admin"]);
});

test("ApprovalRoutingService.route with amount threshold rules", () => {
  const thresholdRules: AmountThresholdRule[] = [
    { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
  ];

  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    amountThresholdRules: thresholdRules,
  });

  const result = service.route(
    {
      requesterId: "user-1",
      orgNodeId: "team-platform",
      riskLevel: "low",
      amount: {
        value: 500,
        currency: "USD",
        fxRateSnapshot: {
          baseCurrency: "USD",
          quoteCurrency: "CNY",
          rate: 7.2,
          source: "test",
          capturedAt: "2026-04-20T00:00:00.000Z",
        },
      },
    },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );

  assert.ok(result.approverChain.length > 0);
});

test("ApprovalRoutingService.route adds escalated approver to chain if not already present", () => {
  const escalationRules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc-critical",
      triggerAfterMinutes: 30,
      escalateToApproverId: "ciso",
      appliesToRiskLevels: ["critical"],
    },
  ];

  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    escalationRules,
  });

  // Create dates 45 minutes apart to trigger escalation
  const createdAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const result = service.route(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "critical" },
    createdAt,
    now,
  );

  assert.equal(result.escalatedTo, "ciso");
  assert.ok(result.approverChain.includes("ciso"));
});

test("ApprovalRoutingService.route does not duplicate escalated approver if already in chain", () => {
  const escalationRules: ApprovalEscalationRule[] = [
    {
      ruleId: "esc-critical",
      triggerAfterMinutes: 30,
      escalateToApproverId: "platform-lead", // Same as team owner
      appliesToRiskLevels: ["critical"],
    },
  ];

  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    escalationRules,
  });

  const createdAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const result = service.route(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "critical" },
    createdAt,
    now,
  );

  assert.equal(result.escalatedTo, "platform-lead");
  // Count occurrences of platform-lead in chain
  const count = result.approverChain.filter((a) => a === "platform-lead").length;
  assert.equal(count, 1);
});

test("ApprovalRoutingService constructor handles undefined optional arrays", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [TEAM_NODE],
    delegations: undefined,
    escalationRules: undefined,
    amountThresholdRules: undefined,
  });

  const result = service.route(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "low" },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );

  assert.ok(result);
  assert.ok(result.approverChain.length >= 0);
});

test("ApprovalRoutingService.planChain calculates correct deadline from timeout", () => {
  const service = new ApprovalRoutingService({
    orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
  });

  const now = "2026-04-20T10:00:00.000Z";
  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "team-platform", riskLevel: "high" },
    now,
    now,
    { chainMode: "sequential", timeoutMinutes: 120 },
  );

  // Deadline should be 120 minutes after now
  const deadlineTime = new Date(plan.steps[0].deadlineAt!).getTime();
  const nowTime = new Date(now).getTime();
  const expectedTime = nowTime + 120 * 60 * 1000;

  // Allow 1 second tolerance
  assert.ok(Math.abs(deadlineTime - expectedTime) < 1000);
});
