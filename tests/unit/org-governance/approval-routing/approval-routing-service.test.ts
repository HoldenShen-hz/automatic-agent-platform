/**
 * Unit tests for ApprovalRoutingService
 *
 * @see src/org-governance/approval-routing/approval-routing-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalRoutingService } from "../../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";
import type { ApprovalDelegation } from "../../../../src/org-governance/approval-routing/delegation/index.js";
import type { ApprovalEscalationRule } from "../../../../src/org-governance/approval-routing/escalation/index.js";

type ApprovalRouteInput = Parameters<ApprovalRoutingService["route"]>[0];

// Helper to create org nodes
function createOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId ?? "node-1",
    nodeType: overrides.nodeType ?? "department",
    displayName: overrides.displayName ?? "Test Node",
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
    effectivePolicies: overrides.effectivePolicies ?? {},
    status: overrides.status ?? (overrides.active ?? true ? "active" : "inactive"),
  };
}

// Helper to create delegations
function createDelegation(overrides: Partial<ApprovalDelegation> = {}): ApprovalDelegation {
  return {
    delegationId: overrides.delegationId ?? "del-1",
    approverId: overrides.approverId ?? "approver-1",
    delegateApproverId: overrides.delegateApproverId ?? "delegate-1",
    delegationType: overrides.delegationType ?? "temporary_cover",
    scopeNodeIds: overrides.scopeNodeIds ?? [],
    conflictOfInterestApproverIds: overrides.conflictOfInterestApproverIds ?? [],
    coiReviewStatus: overrides.coiReviewStatus ?? "pending",
    startsAt: overrides.startsAt ?? "2026-04-01T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-12-31T23:59:59.999Z",
    active: overrides.active ?? true,
  };
}

// Helper to create escalation rules
function createEscalationRule(overrides: Partial<ApprovalEscalationRule> = {}): ApprovalEscalationRule {
  return {
    ruleId: overrides.ruleId ?? "esc-1",
    triggerAfterMinutes: overrides.triggerAfterMinutes ?? 30,
    escalateToApproverId: overrides.escalateToApproverId ?? "escalation-approver",
    appliesToRiskLevels: overrides.appliesToRiskLevels ?? ["high", "critical"],
    maxEscalationDepth: overrides.maxEscalationDepth ?? 1,
    cooldownMinutes: overrides.cooldownMinutes ?? 0,
    notifyOnSlaBreach: overrides.notifyOnSlaBreach ?? false,
    slaBreachNotificationTargetIds: overrides.slaBreachNotificationTargetIds ?? [],
  };
}

test("ApprovalRoutingService creates service with required orgNodes", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  assert.ok(service);
});

test("ApprovalRoutingService creates service with empty delegations array", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations: [] });
  assert.ok(service);
});

test("ApprovalRoutingService creates service with empty escalation rules array", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules: [] });
  assert.ok(service);
});

test("ApprovalRoutingService uses default empty arrays when delegations not provided", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  assert.ok(service);
});

test("ApprovalRoutingService uses default empty arrays when escalationRules not provided", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1" })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  assert.ok(service);
});

test("ApprovalRoutingService routes to org node owners", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
  assert.equal(result.escalatedTo, null);
});

test("ApprovalRoutingService routes to platform_admin when org node has no owners", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: [] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["platform_admin"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService includes audit record with correct structure", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.ok(result.auditRecord);
  assert.ok(result.auditRecord.recordId.length > 0);
  assert.equal(result.auditRecord.action, "approval.route");
  assert.equal(result.auditRecord.actorId, "user-1");
  assert.deepStrictEqual(result.auditRecord.reasonCodes, ["approval.direct_route", "approval.routing.org_chart"]);
});

test("ApprovalRoutingService throws when request orgNodeId not found", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "dept-2", ownerUserIds: ["vp"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  assert.throws(() => service.route(
    { requesterId: "user-1", orgNodeId: "nonexistent", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  ), /approval_route\.org_node_not_found/);
});

test("ApprovalRoutingService applies delegation when approver is delegated", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [
    createDelegation({
      approverId: "director",
      delegateApproverId: "backup-director",
      scopeNodeIds: ["dept-1"],
      startsAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2026-12-31T23:59:59.999Z",
      active: true,
    }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["backup-director"]);
  assert.equal(result.delegated, true);
  assert.ok(result.auditRecord.reasonCodes.includes("approval.delegated"));
});

test("ApprovalRoutingService does not apply delegation when delegation is inactive", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director", active: false })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService does not apply delegation when current time is before start", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [
    createDelegation({
      approverId: "director",
      delegateApproverId: "backup-director",
      startsAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService does not apply delegation when current time is after expiry", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [
    createDelegation({
      approverId: "director",
      delegateApproverId: "backup-director",
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-04-15T00:00:00.000Z",
    }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService applies delegation when scopeNodeIds is empty (global delegation)", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director", scopeNodeIds: [] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["backup-director"]);
  assert.equal(result.delegated, true);
});

test("ApprovalRoutingService does not apply delegation when orgNodeId not in scope", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "dept-2", ownerUserIds: ["vp"] }),
  ];
  const delegations = [
    createDelegation({ approverId: "director", delegateApproverId: "backup-director", scopeNodeIds: ["dept-2"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
  assert.equal(result.delegated, false);
});

test("ApprovalRoutingService escalates when time threshold exceeded for high risk", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const escalationRules = [
    createEscalationRule({
      ruleId: "esc-1",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp-ops",
      appliesToRiskLevels: ["high", "critical"],
    }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:45:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director", "vp-ops"]);
  assert.equal(result.escalatedTo, "vp-ops");
  assert.ok(result.auditRecord.reasonCodes.includes("approval.escalated"));
});

test("ApprovalRoutingService rejects conditional approvers outside the matched org scope", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  assert.throws(
    () => service.planChain(
      { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
      "2026-04-20T00:00:00.000Z",
      "2026-04-20T00:00:00.000Z",
      { chainMode: "conditional", conditionalApproverIds: ["external-user"] },
    ),
    /approval_route\.conditional_approver_not_allowed:external-user/,
  );
});

test("ApprovalRoutingService picks the most specific eligible escalation rule", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const escalationRules = [
    createEscalationRule({
      ruleId: "late",
      triggerAfterMinutes: 60,
      escalateToApproverId: "cto",
      appliesToRiskLevels: ["high", "critical"],
    }),
    createEscalationRule({
      ruleId: "early",
      triggerAfterMinutes: 30,
      escalateToApproverId: "vp-ops",
      appliesToRiskLevels: ["high", "critical"],
    }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T01:15:00.000Z",
  );

  assert.equal(result.escalatedTo, "cto");
});

test("ApprovalRoutingService does not escalate when time threshold not exceeded", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:15:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
  assert.equal(result.escalatedTo, null);
});

test("ApprovalRoutingService does not escalate when risk level not in appliesToRiskLevels", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T01:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
  assert.equal(result.escalatedTo, null);
});

test("ApprovalRoutingService does not duplicate escalated approver if already in chain", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["vp-ops"] })];
  const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T01:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["vp-ops"]);
});

test("ApprovalRoutingService escalates for critical risk when rule applies", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "cto", appliesToRiskLevels: ["critical"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "critical", amountUsd: 10000 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T01:00:00.000Z",
  );
  assert.equal(result.escalatedTo, "cto");
});

test("ApprovalRoutingService applies both delegation and escalation", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director" })];
  const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high", "critical"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T01:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["backup-director", "vp-ops"]);
  assert.equal(result.delegated, true);
  assert.equal(result.escalatedTo, "vp-ops");
});

test("ApprovalRoutingService handles delegation chain then escalation", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [createDelegation({ approverId: "director", delegateApproverId: "interim-director" })];
  const escalationRules = [createEscalationRule({ triggerAfterMinutes: 60, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["medium", "high", "critical"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "medium", amountUsd: 500 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T01:30:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["interim-director", "vp-ops"]);
  assert.equal(result.escalatedTo, "vp-ops");
});

test("ApprovalRoutingService includes delegated reason code when delegated", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const delegations = [createDelegation({ approverId: "director", delegateApproverId: "backup-director" })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, delegations });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.ok(result.auditRecord.reasonCodes.includes("approval.delegated"));
  assert.ok(result.auditRecord.reasonCodes.includes("approval.direct_route") === false);
});

test("ApprovalRoutingService includes direct_route reason code when not delegated", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.ok(result.auditRecord.reasonCodes.includes("approval.direct_route"));
});

test("ApprovalRoutingService includes escalated reason code when escalated", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const escalationRules = [createEscalationRule({ triggerAfterMinutes: 30, escalateToApproverId: "vp-ops", appliesToRiskLevels: ["high"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes, escalationRules });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 1000 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T01:00:00.000Z",
  );
  assert.ok(result.auditRecord.reasonCodes.includes("approval.escalated"));
});

test("ApprovalRoutingService allows when approver chain is not empty", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(result.auditRecord.allowed, true);
});

test("ApprovalRoutingService handles multiple owners", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director", "co-director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director", "co-director"]);
});

test("ApprovalRoutingService routes with all risk levels", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const riskLevels: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];
  for (const riskLevel of riskLevels) {
    const result = service.route(
      { requesterId: "user-1", orgNodeId: "dept-1", riskLevel, amountUsd: 100 },
      "2026-04-20T00:00:00.000Z",
      "2026-04-20T00:00:00.000Z",
    );
    assert.deepStrictEqual(result.approverChain, ["director"], `Failed for risk level: ${riskLevel}`);
  }
});

test("ApprovalRoutingService handles zero amountUsd", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 0 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
});

test("ApprovalRoutingService handles large amountUsd", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "critical", amountUsd: 999999999 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.deepStrictEqual(result.approverChain, ["director"]);
});

test("ApprovalRoutingService finds owner at department level in hierarchy", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"] }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company", ownerUserIds: ["vp"] }),
    createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept", ownerUserIds: ["manager"] }),
    createOrgNode({ orgNodeId: "member", nodeType: "seat", parentOrgNodeId: "team", ownerUserIds: ["employee"] }),
  ];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const result = service.route(
    { requesterId: "employee", orgNodeId: "dept", riskLevel: "low", amountUsd: 100 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(result.matchedOrgNodeId, "dept");
  assert.deepStrictEqual(result.approverChain, ["director"]);
});

test("ApprovalRoutingService exposes amount threshold matrix and sequential chain plan", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director", "vp"] })];
  const thresholdRules = [{ maxAmountUsd: 5_000, targetNodeTypes: ["department"] as const }];
  const service = new ApprovalRoutingService({ orgNodes: nodes, amountThresholdRules: thresholdRules });

  const matrix = service.getAmountThresholdMatrix();
  const plan = service.planChain(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "medium", amountUsd: 300 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:05:00.000Z",
    { chainMode: "sequential", timeoutMinutes: 15 },
  );

  assert.equal(matrix.length, 1);
  assert.equal(plan.chainMode, "sequential");
  assert.equal(plan.steps.length, 2);
  assert.deepStrictEqual(plan.steps[0]?.approverIds, ["director"]);
  assert.ok(plan.steps[0]?.deadlineAt?.includes("T"));
});

test("ApprovalRoutingService builds parallel and conditional chain plans", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director", "vp"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });

  const parallelPlan = service.planChain(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 600 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:05:00.000Z",
    { chainMode: "parallel" },
  );
  const conditionalPlan = service.planChain(
    { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "high", amountUsd: 600 },
    "2026-04-20T00:00:00.000Z",
    "2026-04-20T00:05:00.000Z",
    { chainMode: "conditional", conditionalApproverIds: ["vp"] },
  );

  assert.equal(parallelPlan.steps.length, 1);
  assert.deepStrictEqual(parallelPlan.steps[0]?.approverIds, ["director", "vp"]);
  assert.equal(conditionalPlan.steps.length, 2);
  assert.deepStrictEqual(conditionalPlan.steps[1]?.approverIds, ["vp"]);
});

test("ApprovalRoutingService generates unique audit recordIds for same requester+node", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const request: ApprovalRouteInput = { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 };

  const result1 = service.route(request, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
  const result2 = service.route(request, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
  const result3 = service.route(request, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  // All recordIds must be unique - timestamp + random UUID prevent collisions
  assert.notStrictEqual(result1.auditRecord.recordId, result2.auditRecord.recordId);
  assert.notStrictEqual(result2.auditRecord.recordId, result3.auditRecord.recordId);
  assert.notStrictEqual(result1.auditRecord.recordId, result3.auditRecord.recordId);
});

test("ApprovalRoutingService audit recordId contains timestamp component", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const request: ApprovalRouteInput = { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 };

  const before = Date.now();
  const result = service.route(request, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
  const after = Date.now();

  // recordId should contain a timestamp-like numeric segment
  const recordId = result.auditRecord.recordId;
  const idParts = recordId.split("_");
  // Format: approval_route_audit_{requesterId}_{orgNodeId}_{timestamp}_{uuid}
  // timestamp should be a number >= before and <= after
  const timestampPart = parseInt(idParts[5] ?? "", 10);
  assert.ok(timestampPart >= before && timestampPart <= after, `Timestamp ${timestampPart} should be between ${before} and ${after}`);
});

test("ApprovalRoutingService audit recordId contains random component for entropy", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", ownerUserIds: ["director"] })];
  const service = new ApprovalRoutingService({ orgNodes: nodes });
  const request: ApprovalRouteInput = { requesterId: "user-1", orgNodeId: "dept-1", riskLevel: "low", amountUsd: 100 };

  const result1 = service.route(request, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");
  const result2 = service.route(request, "2026-04-20T00:00:00.000Z", "2026-04-20T00:00:00.000Z");

  // Last segment after timestamp should be a UUID (random)
  const idParts1 = result1.auditRecord.recordId.split("_");
  const idParts2 = result2.auditRecord.recordId.split("_");

  // UUID parts should differ between calls
  assert.notStrictEqual(idParts1[idParts1.length - 1], idParts2[idParts2.length - 1]);
});
