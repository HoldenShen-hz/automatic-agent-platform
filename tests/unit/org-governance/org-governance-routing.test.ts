import test from "node:test";
import assert from "node:assert/strict";

import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";

const companyNode: OrgNode = {
  orgNodeId: "company",
  nodeType: "company",
  displayName: "Acme Corp",
  parentOrgNodeId: null,
  ownerUserIds: ["ceo"],
  active: true,
  costCenter: "CC-000",
  metadata: {},
};

const divisionNode: OrgNode = {
  orgNodeId: "division",
  nodeType: "division",
  displayName: "Engineering",
  parentOrgNodeId: "company",
  ownerUserIds: ["vp-eng"],
  active: true,
  costCenter: "CC-100",
  metadata: {},
};

const deptNode: OrgNode = {
  orgNodeId: "dept",
  nodeType: "department",
  displayName: "Platform",
  parentOrgNodeId: "division",
  ownerUserIds: ["dir-platform"],
  active: true,
  costCenter: "CC-110",
  metadata: {},
};

const teamNode: OrgNode = {
  orgNodeId: "team",
  nodeType: "team",
  displayName: "Runtime",
  parentOrgNodeId: "dept",
  ownerUserIds: ["lead-runtime"],
  active: true,
  costCenter: "CC-111",
  metadata: {},
};

const orgNodes = [companyNode, divisionNode, deptNode, teamNode];

test("ApprovalRoutingService.route returns approver chain from org hierarchy", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  const result = service.route(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    new Date().toISOString(),
    new Date().toISOString(),
  );
  assert.ok(result.approverChain.length > 0);
  assert.ok(result.approverChain.includes("lead-runtime"));
  assert.equal(result.matchedOrgNodeId, "team");
});

test("ApprovalRoutingService.route applies SOD policy to filter conflicted approvers", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  assert.throws(() => {
    service.route(
      {
        requesterId: "lead-runtime",
        orgNodeId: "team",
        riskLevel: "medium",
        requesterManagerIds: ["dir-platform"],
        conflictedApproverIds: ["vp-eng"],
      },
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }, /approval_route\.empty_approver_chain:team|approval_route.empty_approver_chain:team/);
});

test("ApprovalRoutingService.route includes audit record with reason codes", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  const nowIso = new Date().toISOString();
  const result = service.route(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    nowIso,
    nowIso,
  );
  assert.ok(result.auditRecord);
  assert.equal(result.auditRecord.action, "approval.route");
  assert.ok(result.auditRecord.reasonCodes.length > 0);
});

test("ApprovalRoutingService.route respects delegation map", () => {
  const now = new Date();
  const future = new Date(Date.now() + 86400000);
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del-1",
        approverId: "lead-runtime",
        delegateApproverId: "backup-lead",
        delegationType: "temporary_cover",
        scopeNodeIds: ["team"],
        conflictOfInterestApproverIds: [],
        coiReviewStatus: "pending",
        startsAt: now.toISOString(),
        expiresAt: future.toISOString(),
        active: true,
      },
    ],
  });
  const result = service.route(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    new Date().toISOString(),
    new Date().toISOString(),
  );
  assert.equal(result.delegated, true);
  assert.ok(result.approverChain.includes("backup-lead") || result.routeSnapshot.approverIds.includes("backup-lead"));
});

test("ApprovalRoutingService.planChain creates sequential steps by default", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  const nowIso = new Date().toISOString();
  const plan = service.planChain(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    nowIso,
    nowIso,
  );
  assert.equal(plan.chainMode, "sequential");
  assert.ok(plan.steps.length > 0);
  assert.ok(plan.steps.every((step) => step.mode === "sequential"));
});

test("ApprovalRoutingService.planChain creates parallel steps when configured", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  const nowIso = new Date().toISOString();
  const plan = service.planChain(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    nowIso,
    nowIso,
    { chainMode: "parallel" },
  );
  assert.equal(plan.chainMode, "parallel");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.mode, "parallel");
});

test("ApprovalRoutingService.planChain applies timeout deadline", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  const nowIso = new Date().toISOString();
  const plan = service.planChain(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    nowIso,
    nowIso,
    { timeoutMinutes: 60 },
  );
  assert.ok(plan.steps[0]?.deadlineAt != null);
  assert.ok(new Date(plan.steps[0]!.deadlineAt!) > new Date(nowIso));
});

test("ApprovalRoutingService.planChain adds conditional approvers when specified", () => {
  const service = new ApprovalRoutingService({ orgNodes });
  const nowIso = new Date().toISOString();
  const plan = service.planChain(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    nowIso,
    nowIso,
    { chainMode: "conditional", conditionalApproverIds: ["security-reviewer"] },
  );
  assert.equal(plan.chainMode, "conditional");
  const conditionalStep = plan.steps.find((s) => s.approverIds.includes("security-reviewer"));
  assert.ok(conditionalStep);
  assert.ok(conditionalStep!.reasonCodes.includes("approval.routing.conditional"));
});

test("ApprovalRoutingService.getAmountThresholdMatrix returns configured rules", () => {
  const rules = [{ maxAmountCny: 10000, targetNodeTypes: ["team"] as const }];
  const service = new ApprovalRoutingService({ orgNodes, amountThresholdRules: rules });
  const matrix = service.getAmountThresholdMatrix();
  assert.equal(matrix.length, 1);
  assert.equal(matrix[0]?.maxAmountCny, 10000);
});

test("ApprovalRoutingService.route applies escalation for high risk requests after timeout", () => {
  const now = new Date();
  const created = new Date(now.getTime() - 60 * 60 * 1000);
  const service = new ApprovalRoutingService({
    orgNodes,
    escalationRules: [
      {
        ruleId: "esc-1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp-eng",
        escalateToParentManager: false,
        appliesToRiskLevels: ["high", "critical"],
        escalationLevel: 1,
      },
    ],
  });
  const result = service.route(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "high",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    created.toISOString(),
    now.toISOString(),
  );
  assert.equal(result.escalatedTo, "vp-eng");
});

test("ApprovalRoutingService.route does not escalate for low risk when threshold is high", () => {
  const now = new Date();
  const created = new Date(now.getTime() - 60 * 60 * 1000);
  const service = new ApprovalRoutingService({
    orgNodes,
    escalationRules: [
      {
        ruleId: "esc-1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp-eng",
        escalateToParentManager: false,
        appliesToRiskLevels: ["critical"],
        escalationLevel: 1,
      },
    ],
  });
  const result = service.route(
    {
      requesterId: "engineer",
      orgNodeId: "team",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    created.toISOString(),
    now.toISOString(),
  );
  assert.equal(result.escalatedTo, null);
});

test("ApprovalRoutingService handles empty org nodes gracefully", () => {
  const service = new ApprovalRoutingService({ orgNodes: [] });
  const nowIso = new Date().toISOString();
  const result = service.route(
    {
      requesterId: "engineer",
      orgNodeId: "nonexistent",
      riskLevel: "low",
      requesterManagerIds: [],
      conflictedApproverIds: [],
    },
    nowIso,
    nowIso,
  );
  assert.ok(result.approverChain);
  assert.equal(result.routingStrategy, "org_chart");
});
