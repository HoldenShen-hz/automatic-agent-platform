import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

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

const DEPT_1 = createOrgNode({ orgNodeId: "dept_1", nodeType: "department", parentOrgNodeId: null, ownerUserIds: ["director"] });
const DEPT_2 = createOrgNode({ orgNodeId: "dept_2", nodeType: "department", parentOrgNodeId: null, ownerUserIds: ["director_2"] });
const TEAM_1 = createOrgNode({ orgNodeId: "team_1", nodeType: "team", parentOrgNodeId: "dept_1", ownerUserIds: ["team_mgr"] });

const orgNodes: OrgNode[] = [DEPT_1, DEPT_2, TEAM_1];

// ─────────────────────────────────────────────────────────────────────────────
// route() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ApprovalRoutingService.route returns direct route without delegation or escalation", () => {
  const service = new ApprovalRoutingService({ orgNodes });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "low",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  assert.deepEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
  assert.equal(result.escalatedTo, null);
  assert.equal(result.routingStrategy, "org_chart");
  assert.ok(result.auditRecord.reasonCodes.includes("approval.direct_route"));
});

test("ApprovalRoutingService.route applies delegation when in scope and active", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del_1",
        approverId: "director",
        delegateApproverId: "backup_director",
        scopeNodeIds: ["dept_1"],
        startsAt: "2026-04-01T00:00:00.000Z",
        expiresAt: "2026-12-31T00:00:00.000Z",
        active: true,
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  assert.deepEqual(result.approverChain, ["backup_director"]);
  assert.equal(result.delegated, true);
  assert.ok(result.auditRecord.reasonCodes.includes("approval.delegated"));
});

test("ApprovalRoutingService.route does not apply inactive delegation", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del_1",
        approverId: "director",
        delegateApproverId: "backup_director",
        scopeNodeIds: ["dept_1"],
        startsAt: "2026-04-01T00:00:00.000Z",
        expiresAt: "2026-12-31T00:00:00.000Z",
        active: false, // Inactive
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  assert.deepEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService.route does not apply expired delegation", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del_1",
        approverId: "director",
        delegateApproverId: "backup_director",
        scopeNodeIds: ["dept_1"],
        startsAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-03-01T00:00:00.000Z", // Expired
        active: true,
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  assert.deepEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService.route does not apply delegation outside scope", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del_1",
        approverId: "director",
        delegateApproverId: "backup_director",
        scopeNodeIds: ["other_dept"], // Different scope
        startsAt: "2026-04-01T00:00:00.000Z",
        expiresAt: "2026-12-31T00:00:00.000Z",
        active: true,
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  assert.deepEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService.route applies escalation when threshold exceeded", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    escalationRules: [
      {
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp_ops",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "high",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z"); // 60 minutes later

  assert.ok(result.approverChain.includes("vp_ops"));
  assert.equal(result.escalatedTo, "vp_ops");
  assert.ok(result.auditRecord.reasonCodes.includes("approval.escalated"));
});

test("ApprovalRoutingService.route does not escalate when time threshold not met", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    escalationRules: [
      {
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp_ops",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "high",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:15:00.000Z"); // Only 15 minutes

  assert.equal(result.escalatedTo, null);
  assert.ok(!result.auditRecord.reasonCodes.includes("approval.escalated"));
});

test("ApprovalRoutingService.route does not escalate for low risk when rule targets high/critical", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    escalationRules: [
      {
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp_ops",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "low",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T02:00:00.000Z");

  assert.equal(result.escalatedTo, null);
});

test("ApprovalRoutingService.route combines delegation and escalation", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del_1",
        approverId: "director",
        delegateApproverId: "backup_director",
        scopeNodeIds: ["dept_1"],
        startsAt: "2026-04-01T00:00:00.000Z",
        expiresAt: "2026-12-31T00:00:00.000Z",
        active: true,
      },
    ],
    escalationRules: [
      {
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp_ops",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "high",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");

  assert.deepEqual(result.approverChain, ["backup_director", "vp_ops"]);
  assert.equal(result.delegated, true);
  assert.equal(result.escalatedTo, "vp_ops");
});

test("ApprovalRoutingService.route handles node without ownerUserIds", () => {
  const nodesWithoutOwner: OrgNode[] = [
    createOrgNode({ orgNodeId: "empty_dept", nodeType: "department", parentOrgNodeId: null, ownerUserIds: [] }),
  ];

  const service = new ApprovalRoutingService({ orgNodes: nodesWithoutOwner });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "empty_dept",
    riskLevel: "low",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  assert.deepEqual(result.approverChain, ["platform_admin"]);
});

test("ApprovalRoutingService.route applies SoD policy to filter initiator", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [],
    escalationRules: [],
  });

  // Requester is "director" who is also the approver - should be filtered
  const result = service.route({
    requesterId: "director",
    orgNodeId: "dept_1",
    riskLevel: "low",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  // Director is filtered out by SoD policy
  assert.ok(!result.approverChain.includes("director"));
});

// ─────────────────────────────────────────────────────────────────────────────
// getAmountThresholdMatrix() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ApprovalRoutingService.getAmountThresholdMatrix returns empty by default", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  const matrix = service.getAmountThresholdMatrix();
  assert.deepEqual(matrix, []);
});

test("ApprovalRoutingService.getAmountThresholdMatrix returns configured rules", () => {
  const rules = [
    { maxAmountUsd: 1000, targetNodeTypes: ["department"] as const },
    { maxAmountUsd: 5000, targetNodeTypes: ["team"] as const },
  ];

  const service = new ApprovalRoutingService({
    orgNodes,
    amountThresholdRules: rules,
  });

  const matrix = service.getAmountThresholdMatrix();
  assert.equal(matrix.length, 2);
  assert.equal(matrix[0]?.maxAmountUsd, 1000);
  assert.equal(matrix[1]?.maxAmountUsd, 5000);
});

// ─────────────────────────────────────────────────────────────────────────────
// planChain() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ApprovalRoutingService.planChain creates sequential chain by default", () => {
  const service = new ApprovalRoutingService({ orgNodes });

  const plan = service.planChain({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  assert.equal(plan.chainMode, "sequential");
  assert.equal(plan.matchedOrgNodeId, "dept_1");
  assert.ok(plan.steps.length > 0);
  assert.equal(plan.steps[0]?.mode, "sequential");
});

test("ApprovalRoutingService.planChain creates parallel chain", () => {
  // Use team_1 which has multiple ownerUserIds for parallel chain testing
  const service = new ApprovalRoutingService({ orgNodes });

  const plan = service.planChain({
    requesterId: "user_1",
    orgNodeId: "team_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z", { chainMode: "parallel" });

  assert.equal(plan.chainMode, "parallel");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.mode, "parallel");
  assert.ok(plan.steps[0]?.approverIds.length >= 1);
});

test("ApprovalRoutingService.planChain includes conditional approvers", () => {
  const service = new ApprovalRoutingService({ orgNodes });

  const plan = service.planChain({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z", {
    chainMode: "conditional",
    conditionalApproverIds: ["security_team", "compliance_team"],
  });

  assert.equal(plan.chainMode, "conditional");
  assert.ok(plan.steps.some((s) => s.approverIds.includes("security_team")));
  assert.ok(plan.steps.some((s) => s.approverIds.includes("compliance_team")));
});

test("ApprovalRoutingService.planChain calculates deadline correctly", () => {
  const service = new ApprovalRoutingService({ orgNodes });

  const plan = service.planChain({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z", {
    timeoutMinutes: 60,
  });

  assert.ok(plan.steps[0]?.deadlineAt != null);
  const deadline = new Date(plan.steps[0]?.deadlineAt!);
  const expected = new Date("2026-04-20T01:00:00.000Z");
  assert.equal(deadline.getTime(), expected.getTime());
});

test("ApprovalRoutingService.planChain sets escalation target", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    escalationRules: [
      {
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp_ops",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const plan = service.planChain({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "high",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");

  assert.equal(plan.steps[0]?.escalationTarget, "vp_ops");
});

test("ApprovalRoutingService.planChain generates unique stepIds", () => {
  const service = new ApprovalRoutingService({ orgNodes });

  const plan = service.planChain({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  const stepIds = plan.steps.map((s) => s.stepId);
  const uniqueIds = new Set(stepIds);
  assert.equal(uniqueIds.size, stepIds.length, "All stepIds should be unique");
});

test("ApprovalRoutingService.planChain with empty conditionalApproverIds", () => {
  const service = new ApprovalRoutingService({ orgNodes });

  const plan = service.planChain({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "medium",
    amountUsd: 0,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z", {
    chainMode: "conditional",
    conditionalApproverIds: [], // Empty
  });

  assert.equal(plan.chainMode, "conditional");
  // Should still work with just the regular approvers
  assert.ok(plan.steps.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: delegation + escalation + chain planning
// ─────────────────────────────────────────────────────────────────────────────

test("ApprovalRoutingService applies delegation and escalation", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del_1",
        approverId: "director",
        delegateApproverId: "backup_director",
        scopeNodeIds: ["dept_1"],
        startsAt: "2026-04-20T00:00:00.000Z",
        expiresAt: "2026-04-21T00:00:00.000Z",
        active: true,
      },
    ],
    escalationRules: [
      {
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp_ops",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "high",
    amountUsd: 1000,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");

  assert.deepEqual(result.approverChain, ["backup_director", "vp_ops"]);
  assert.equal(result.delegated, true);
  assert.equal(result.escalatedTo, "vp_ops");
  assert.ok(result.auditRecord.reasonCodes?.includes("approval.escalated"));
});
