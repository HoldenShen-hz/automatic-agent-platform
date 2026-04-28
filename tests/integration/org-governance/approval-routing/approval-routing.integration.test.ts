/**
 * Integration Test: Approval Routing Service
 *
 * Tests integration between approval routing service, org nodes,
 * delegations, escalation rules, and amount thresholds.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import { resolveApprovalRoute } from "../../../src/org-governance/approval-routing/route-engine/index.js";
import { shouldEscalateApproval, resolveEscalationApprover } from "../../../src/org-governance/approval-routing/escalation/index.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";
import type { ApprovalDelegation } from "../../../src/org-governance/approval-routing/delegation/index.js";
import type { ApprovalEscalationRule } from "../../../src/org-governance/approval-routing/escalation/index.js";
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

test("integration: ApprovalRoutingService routes approval through org hierarchy", () => {
  const ctx = createIntegrationContext("aa-approval-routing-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const result = service.route({
      requesterId: "engineer-1",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso());

    assert.equal(result.matchedOrgNodeId, "team-platform");
    assert.ok(result.approverChain.length > 0);
    assert.equal(result.escalatedTo, null);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService applies delegation map", () => {
  const ctx = createIntegrationContext("aa-approval-delegation-");
  try {
    const delegations: ApprovalDelegation[] = [
      {
        delegationId: "del-001",
        delegatorId: "vp-eng",
        delegateeId: "tech-lead",
        orgNodeId: "dept-eng",
        grantedAt: "2024-01-01T00:00:00.000Z",
        expiresAt: "2025-01-01T00:00:00.000Z",
        scope: { kind: "approval_delegation", policyIds: ["*"] },
        status: "active",
        successor: false,
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
    }, "2024-06-01T00:00:00.000Z", "2024-06-15T00:00:00.000Z");

    assert.ok(result.approverChain.includes("tech-lead") || result.delegated);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService resolves escalation for high-risk requests", () => {
  const ctx = createIntegrationContext("aa-approval-escalation-");
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

    const createdAt = new Date(Date.now() - 45 * 60_000).toISOString();
    const now = new Date().toISOString();

    const result = service.route({
      requesterId: "admin-1",
      orgNodeId: "company",
      riskLevel: "high",
    }, createdAt, now);

    assert.equal(result.escalatedTo, "ciso");
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService plans approval chain in sequential mode", () => {
  const ctx = createIntegrationContext("aa-approval-chain-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const plan = service.planChain({
      requesterId: "engineer-3",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso(), { chainMode: "sequential" });

    assert.equal(plan.chainMode, "sequential");
    assert.equal(plan.matchedOrgNodeId, "team-platform");
    assert.ok(plan.steps.length > 0);
    assert.ok(plan.steps[0].approverIds.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService plans approval chain in parallel mode", () => {
  const ctx = createIntegrationContext("aa-approval-chain-parallel-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const plan = service.planChain({
      requesterId: "engineer-4",
      orgNodeId: "dept-eng",
      riskLevel: "medium",
    }, nowIso(), nowIso(), { chainMode: "parallel" });

    assert.equal(plan.chainMode, "parallel");
    assert.ok(plan.steps.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService includes deadline in chain plan when specified", () => {
  const ctx = createIntegrationContext("aa-approval-chain-deadline-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const plan = service.planChain({
      requesterId: "engineer-5",
      orgNodeId: "team-platform",
      riskLevel: "high",
    }, nowIso(), nowIso(), { chainMode: "sequential", timeoutMinutes: 120 });

    assert.ok(plan.steps.every((step) => step.deadlineAt != null));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService builds audit record with reason codes", () => {
  const ctx = createIntegrationContext("aa-approval-audit-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const result = service.route({
      requesterId: "engineer-6",
      orgNodeId: "team-platform",
      riskLevel: "medium",
    }, nowIso(), nowIso());

    assert.ok(result.auditRecord.reasonCodes.length > 0);
    assert.ok(result.auditRecord.reasonCodes.some((code) => code.startsWith("approval.")));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService with amount thresholds uses amount-based routing", () => {
  const ctx = createIntegrationContext("aa-approval-amount-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      amountThresholdRules: [
        { maxAmountUsd: 1000, targetNodeTypes: ["team"] },
        { maxAmountUsd: 50000, targetNodeTypes: ["department"] },
      ],
    });

    const result = service.route({
      requesterId: "engineer-7",
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

    assert.equal(result.routingStrategy, "amount_based");
  } finally {
    ctx.cleanup();
  }
});

test("integration: ApprovalRoutingService with seeded context persists execution", () => {
  const ctx = createSeededIntegrationContext("aa-approval-seeded-");
  try {
    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
    });

    const result = service.route({
      requesterId: "engineer-seeded",
      orgNodeId: "team-platform",
      riskLevel: "low",
    }, nowIso(), nowIso());

    assert.ok(result.approverChain.length > 0);

    const count = ctx.store.countExecutions();
    assert.ok(count >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("integration: resolveApprovalRoute with delegation map applies delegation correctly", () => {
  const ctx = createIntegrationContext("aa-resolve-route-");
  try {
    const delegationMap: Record<string, string> = {
      "ceo": "interim-ceo",
      "vp-eng": "tech-lead",
    };

    const result = resolveApprovalRoute(
      [COMPANY_NODE, DEPT_NODE],
      {
        requesterId: "user-1",
        orgNodeId: "dept-eng",
        riskLevel: "low",
      },
      delegationMap,
      [],
    );

    assert.ok(result.approverChain.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: shouldEscalateApproval returns true when time threshold reached", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "rule-1",
    triggerAfterMinutes: 60,
    escalateToApproverId: "escalation-target",
    appliesToRiskLevels: ["high", "critical"],
  };

  const createdAt = new Date(Date.now() - 90 * 60_000).toISOString();
  const now = new Date().toISOString();

  const result = shouldEscalateApproval(rule, createdAt, now, "high");

  assert.equal(result, true);
});

test("integration: resolveEscalationApprover uses escalateToApproverId when specified", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "rule-2",
    triggerAfterMinutes: 30,
    escalateToApproverId: "specific-approver",
    appliesToRiskLevels: ["high", "critical"],
  };

  const nodes = [
    { orgNodeId: "node-1", parentOrgNodeId: null, ownerUserIds: ["owner-1"] },
  ];

  const result = resolveEscalationApprover({
    requesterId: "user-req",
    currentApproverId: "current",
    orgNodeId: "node-1",
    requesterManagerIds: [],
  }, nodes, rule);

  assert.equal(result, "specific-approver");
});

test("integration: ApprovalRoutingService getAmountThresholdMatrix returns all rules", () => {
  const ctx = createIntegrationContext("aa-threshold-matrix-");
  try {
    const rules = [
      { maxAmountUsd: 1000, targetNodeTypes: ["team"] as const },
      { maxAmountUsd: 50000, targetNodeTypes: ["department"] as const },
    ];

    const service = new ApprovalRoutingService({
      orgNodes: [COMPANY_NODE, DEPT_NODE, TEAM_NODE],
      amountThresholdRules: rules,
    });

    const matrix = service.getAmountThresholdMatrix();

    assert.equal(matrix.length, 2);
  } finally {
    ctx.cleanup();
  }
});
