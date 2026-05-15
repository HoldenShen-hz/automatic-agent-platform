/**
 * Integration Test: Approval Routing Service
 *
 * Tests integration between approval routing service, database persistence,
 * delegation state, and org node lookups.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";
import type { ApprovalDelegation } from "../../../src/org-governance/approval-routing/delegation/index.js";
import type { ApprovalEscalationRule } from "../../../src/org-governance/approval-routing/escalation/index.js";
import type { AmountThresholdRule } from "../../../src/org-governance/approval-routing/route-engine/index.js";
import { createIntegrationContext, createSeededIntegrationContext } from "../../helpers/integration-context.js";
import { nowIso } from "../../../src/platform/contracts/types/ids.js";

const COMPANY_NODE: OrgNode = {
  orgNodeId: "company",
  nodeType: "company",
  displayName: "Acme Corp",
  parentOrgNodeId: null,
  ownerUserIds: ["ceo"],
  active: true,
  costCenter: "cc-001",
  metadata: {},
};

const DEPT_NODE: OrgNode = {
  orgNodeId: "dept-eng",
  nodeType: "department",
  displayName: "Engineering",
  parentOrgNodeId: "company",
  ownerUserIds: ["vp-eng"],
  active: true,
  costCenter: "cc-eng",
  metadata: {},
};

const TEAM_NODE: OrgNode = {
  orgNodeId: "team-platform",
  nodeType: "team",
  displayName: "Platform Team",
  parentOrgNodeId: "dept-eng",
  ownerUserIds: ["platform-lead"],
  active: true,
  costCenter: "cc-plat",
  metadata: {},
};

test("integration: ApprovalRoutingService.route persists audit record in database", () => {
  const ctx = createIntegrationContext("aa-approval-audit-db-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const result = service.route({
      requesterId: "engineer-1",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso());

    // Verify audit record has all required fields
    assert.ok(result.auditRecord.recordId);
    assert.equal(result.auditRecord.action, "approval.route");
    assert.equal(result.auditRecord.actorId, "engineer-1");
    assert.equal(result.auditRecord.orgNodeId, "team-platform");
    assert.equal(result.auditRecord.allowed, true);
    assert.ok(result.auditRecord.reasonCodes.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route with delegation persists delegation mapping", () => {
  const ctx = createIntegrationContext("aa-approval-delegation-db-");
  try {
    const delegations: ApprovalDelegation[] = [
      {
        delegationId: "del-001",
        approverId: "vp-eng",
        delegateApproverId: "tech-lead",
        delegationType: "temporary_cover",
        scopeNodeIds: ["dept-eng"],
        conflictOfInterestApproverIds: [],
        coiReviewStatus: "pending",
        startsAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-12-31T23:59:59.999Z",
        active: true,
      },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      delegations,
    });

    const result = service.route({
      requesterId: "engineer-2",
      orgNodeId: "dept-eng",
      riskLevel: "low",
    }, nowIso(), nowIso());

    // Delegation should be applied
    assert.equal(result.delegated, true);
    assert.ok(result.approverChain.includes("tech-lead"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route with escalation persists escalation record", () => {
  const ctx = createIntegrationContext("aa-approval-escalation-db-");
  try {
    const escalationRules: ApprovalEscalationRule[] = [
      {
        ruleId: "esc-rule-001",
        triggerAfterMinutes: 30,
        escalateToApproverId: "ciso",
        appliesToRiskLevels: ["high", "critical"],
      },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      escalationRules,
    });

    // Create dates 45 minutes apart to trigger escalation
    const createdAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const result = service.route({
      requesterId: "admin-1",
      orgNodeId: "company",
      riskLevel: "critical",
    }, createdAt, now);

    // Escalation should be triggered
    assert.equal(result.escalatedTo, "ciso");
    assert.ok(result.approverChain.includes("ciso"));
    assert.ok(result.auditRecord.reasonCodes.includes("approval.escalated"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.planChain creates approval chain with database task", () => {
  const ctx = createSeededIntegrationContext("aa-approval-chain-db-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const plan = service.planChain({
      requesterId: "engineer-3",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso(), { chainMode: "sequential", timeoutMinutes: 60 });

    // Verify chain plan structure
    assert.equal(plan.chainMode, "sequential");
    assert.equal(plan.matchedOrgNodeId, "team-platform");
    assert.ok(plan.steps.length > 0);
    assert.ok(plan.steps[0].deadlineAt != null);
    assert.ok(plan.steps[0].reasonCodes.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route with amount threshold persists threshold routing", () => {
  const ctx = createIntegrationContext("aa-approval-amount-db-");
  try {
    const amountThresholdRules: AmountThresholdRule[] = [
      { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
      { maxAmountUsd: 50000, targetNodeTypes: ["department"] },
      { maxAmountUsd: 500000, targetNodeTypes: ["company"] },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      amountThresholdRules,
    });

    const result = service.route({
      requesterId: "engineer-4",
      orgNodeId: "team-platform",
      riskLevel: "medium",
      amount: {
        value: 50000,
        currency: "USD",
        fxRateSnapshot: {
          baseCurrency: "USD",
          quoteCurrency: "CNY",
          rate: 7.2,
          source: "test",
          capturedAt: nowIso(),
        },
      },
    }, nowIso(), nowIso());

    // Should have approvers from team
    assert.ok(result.approverChain.length > 0);
    assert.ok(result.auditRecord.reasonCodes.some((code) => code.includes("approval.routing")));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route through org hierarchy", () => {
  const ctx = createIntegrationContext("aa-approval-hierarchy-db-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    // Route through team should bubble up to team lead
    const result = service.route({
      requesterId: "engineer-5",
      orgNodeId: "team-platform",
      riskLevel: "low",
    }, nowIso(), nowIso());

    assert.equal(result.matchedOrgNodeId, "team-platform");
    assert.ok(result.approverChain.includes("platform-lead"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route rejects unknown org node", () => {
  const ctx = createIntegrationContext("aa-approval-fallback-db-");
  try {
    // Team node only, no parent in orgNodes
    const service = new ApprovalRoutingService({
      orgNodes: [TEAM_NODE],
    });

    assert.throws(
      () => service.route({
        requesterId: "engineer-6",
        orgNodeId: "nonexistent",
        riskLevel: "low",
      }, nowIso(), nowIso()),
      /approval_route\.org_node_not_found:nonexistent/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.planChain parallel mode creates single step with all approvers", () => {
  const ctx = createIntegrationContext("aa-approval-parallel-db-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const plan = service.planChain({
      requesterId: "engineer-7",
      orgNodeId: "dept-eng",
      riskLevel: "medium",
    }, nowIso(), nowIso(), { chainMode: "parallel" });

    assert.equal(plan.chainMode, "parallel");
    // In parallel mode, all approvers in single step
    assert.equal(plan.steps.length, 1);
    assert.ok(plan.steps[0].approverIds.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.planChain conditional mode adds conditional approvers", () => {
  const ctx = createIntegrationContext("aa-approval-conditional-db-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const plan = service.planChain({
      requesterId: "engineer-8",
      orgNodeId: "team-platform",
      riskLevel: "high",
    }, nowIso(), nowIso(), {
      chainMode: "conditional",
      conditionalApproverIds: ["security-reviewer", "compliance-officer"],
    });

    assert.equal(plan.chainMode, "conditional");
    const allApprovers = plan.steps.flatMap((s) => s.approverIds);
    assert.ok(allApprovers.includes("security-reviewer"));
    assert.ok(allApprovers.includes("compliance-officer"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route inactive delegation not applied", () => {
  const ctx = createIntegrationContext("aa-approval-inactive-del-db-");
  try {
    const delegations: ApprovalDelegation[] = [
      {
        delegationId: "del-inactive",
        approverId: "platform-lead",
        delegateApproverId: "backup-lead",
        delegationType: "temporary_cover",
        scopeNodeIds: ["team-platform"],
        conflictOfInterestApproverIds: [],
        coiReviewStatus: "pending",
        startsAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-12-31T23:59:59.999Z",
        active: false, // Inactive
      },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      delegations,
    });

    const result = service.route({
      requesterId: "engineer-9",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso());

    // Inactive delegation should not be applied
    assert.equal(result.delegated, false);
    assert.ok(result.approverChain.includes("platform-lead"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route expired delegation not applied", () => {
  const ctx = createIntegrationContext("aa-approval-expired-del-db-");
  try {
    const delegations: ApprovalDelegation[] = [
      {
        delegationId: "del-expired",
        approverId: "platform-lead",
        delegateApproverId: "backup-lead",
        delegationType: "temporary_cover",
        scopeNodeIds: ["team-platform"],
        conflictOfInterestApproverIds: [],
        coiReviewStatus: "pending",
        startsAt: "2020-01-01T00:00:00.000Z",
        expiresAt: "2021-01-01T00:00:00.000Z", // Expired
        active: true,
      },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      delegations,
    });

    const result = service.route({
      requesterId: "engineer-10",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso());

    // Expired delegation should not be applied
    assert.equal(result.delegated, false);
    assert.ok(result.approverChain.includes("platform-lead"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.route future delegation not applied", () => {
  const ctx = createIntegrationContext("aa-approval-future-del-db-");
  try {
    const delegations: ApprovalDelegation[] = [
      {
        delegationId: "del-future",
        approverId: "platform-lead",
        delegateApproverId: "backup-lead",
        delegationType: "temporary_cover",
        scopeNodeIds: ["team-platform"],
        conflictOfInterestApproverIds: [],
        coiReviewStatus: "pending",
        startsAt: "2030-01-01T00:00:00.000Z", // Future
        expiresAt: "2031-01-01T00:00:00.000Z",
        active: true,
      },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      delegations,
    });

    const result = service.route({
      requesterId: "engineer-11",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso());

    // Future delegation should not be applied
    assert.equal(result.delegated, false);
    assert.ok(result.approverChain.includes("platform-lead"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService.getAmountThresholdMatrix returns copy", () => {
  const ctx = createIntegrationContext("aa-approval-matrix-db-");
  try {
    const amountThresholdRules: AmountThresholdRule[] = [
      { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [TEAM_NODE],
      amountThresholdRules,
    });

    const matrix1 = service.getAmountThresholdMatrix();
    const matrix2 = service.getAmountThresholdMatrix();

    // Should be equal but not same reference
    assert.deepEqual(matrix1, matrix2);
    assert.notEqual(matrix1, matrix2);
  } finally {
    ctx.cleanup();
  }
});
