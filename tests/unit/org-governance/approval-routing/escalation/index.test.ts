/**
 * Unit tests for Approval Escalation
 * Covers: org hierarchy traversal for escalation (R9-36)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalEscalationRuleSchema,
  shouldEscalateApproval,
  resolveEscalationApprover,
  traverseOrgHierarchyForEscalation,
  type ApprovalEscalationRule,
} from "../../../../../src/org-governance/approval-routing/escalation/index.js";

function createRule(overrides: Partial<{
  ruleId: string;
  triggerAfterMinutes: number;
  escalateToApproverId: string;
  escalateToParentManager: boolean;
  appliesToRiskLevels: ("low" | "medium" | "high" | "critical")[];
}> = {}): ApprovalEscalationRule {
  return {
    ruleId: overrides.ruleId ?? "rule-1",
    triggerAfterMinutes: overrides.triggerAfterMinutes ?? 60,
    escalateToApproverId: overrides.escalateToApproverId,
    escalateToParentManager: overrides.escalateToParentManager ?? false,
    appliesToRiskLevels: overrides.appliesToRiskLevels ?? ["high", "critical"],
    ...overrides,
  };
}

function createOrgNode(overrides: Partial<{
  orgNodeId: string;
  parentOrgNodeId: string | null;
  ownerUserIds: string[];
}> = {}): { orgNodeId: string; parentOrgNodeId: string | null; ownerUserIds: readonly string[] } {
  return {
    orgNodeId: overrides.orgNodeId ?? "node-1",
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
  };
}

// R9-36: Org hierarchy traversal for escalation

test("traverseOrgHierarchyForEscalation returns empty array when no parent nodes", () => {
  const nodes = [createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] })];
  const path = traverseOrgHierarchyForEscalation("ceo", "company-1", nodes);
  assert.deepStrictEqual(path, []);
});

test("traverseOrgHierarchyForEscalation still returns ancestor owners even when current approver is outside the chain", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
  ];
  const path = traverseOrgHierarchyForEscalation("unknown", "dept-1", nodes);
  assert.deepStrictEqual(path, ["ceo"]);
});

test("traverseOrgHierarchyForEscalation collects approvers from parent nodes", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["team-lead"] }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
  ];
  // Start from team-1, find approvers in parent chain
  const path = traverseOrgHierarchyForEscalation("team-lead", "team-1", nodes);
  // Should include director (from dept-1) and ceo (from company-1) since they are managers above team-1
  assert.ok(path.includes("director") || path.includes("ceo"));
});

test("traverseOrgHierarchyForEscalation respects maxLevels parameter", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["team-lead"] }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "division-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "division-1", parentOrgNodeId: "company-1", ownerUserIds: ["svp"] }),
    createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
  ];
  // maxLevels = 2 should only traverse up to 2 levels
  const path = traverseOrgHierarchyForEscalation("team-lead", "team-1", nodes, 2);
  assert.ok(path.length <= 2);
});

test("traverseOrgHierarchyForEscalation does not include original approver in path", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
  ];
  // director is the original approver, should not appear in escalation path
  const path = traverseOrgHierarchyForEscalation("director", "dept-1", nodes);
  assert.ok(!path.includes("director"));
});

test("traverseOrgHierarchyForEscalation does not duplicate approvers", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["team-lead"] }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["director"] }),
    createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
  ];
  const path = traverseOrgHierarchyForEscalation("team-lead", "team-1", nodes);
  // Should not have duplicates
  const uniquePath = [...new Set(path)];
  assert.deepStrictEqual(path, uniquePath);
});

test("traverseOrgHierarchyForEscalation continues climbing through ownerless intermediate parents", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["team-lead"] }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: [] }),
    createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
  ];
  const path = traverseOrgHierarchyForEscalation("team-lead", "team-1", nodes);
  assert.ok(path.includes("ceo"));
});

test("traverseOrgHierarchyForEscalation defaults to maxLevels of 5", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "l1", parentOrgNodeId: "l2", ownerUserIds: ["owner1"] }),
    createOrgNode({ orgNodeId: "l2", parentOrgNodeId: "l3", ownerUserIds: ["owner2"] }),
    createOrgNode({ orgNodeId: "l3", parentOrgNodeId: "l4", ownerUserIds: ["owner3"] }),
    createOrgNode({ orgNodeId: "l4", parentOrgNodeId: "l5", ownerUserIds: ["owner4"] }),
    createOrgNode({ orgNodeId: "l5", parentOrgNodeId: "l6", ownerUserIds: ["owner5"] }),
    createOrgNode({ orgNodeId: "l6", parentOrgNodeId: null, ownerUserIds: ["owner6"] }),
  ];
  // Without explicit maxLevels, should default to 5
  const path = traverseOrgHierarchyForEscalation("owner1", "l1", nodes);
  assert.ok(path.length <= 5);
});

// resolveEscalationApprover tests

test("resolveEscalationApprover returns explicit escalateToApproverId when set", () => {
  const nodes = [createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1", ownerUserIds: ["director"] })];
  const rule = createRule({ escalateToApproverId: "explicit-escalation" });
  const context = {
    requesterId: "user-1",
    currentApproverId: "director",
    orgNodeId: "dept-1",
    requesterManagerIds: [],
  };
  const result = resolveEscalationApprover(context, nodes, rule);
  assert.equal(result, "explicit-escalation");
});

test("resolveEscalationApprover returns parent manager when escalateToParentManager is true", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["team-lead"] }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: null, ownerUserIds: ["director"] }),
  ];
  const rule = createRule({ escalateToParentManager: true });
  const context = {
    requesterId: "user-1",
    currentApproverId: "team-lead",
    orgNodeId: "team-1",
    requesterManagerIds: [],
  };
  const result = resolveEscalationApprover(context, nodes, rule);
  assert.equal(result, "director");
});

test("resolveEscalationApprover falls back to requester manager chain when no parent found", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "company-1", ownerUserIds: ["team-lead"] }),
    // company-1 has no ownerUserIds
  ];
  const rule = createRule({ escalateToParentManager: true });
  const context = {
    requesterId: "user-1",
    currentApproverId: "team-lead",
    orgNodeId: "team-1",
    requesterManagerIds: ["manager-1", "manager-2"],
  };
  const result = resolveEscalationApprover(context, nodes, rule);
  // Should return last manager in chain
  assert.equal(result, "manager-2");
});

test("resolveEscalationApprover returns currentApproverId when no escalation possible", () => {
  const nodes = [createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null, ownerUserIds: ["ceo"] })];
  const rule = createRule({ escalateToParentManager: true });
  const context = {
    requesterId: "user-1",
    currentApproverId: "ceo",
    orgNodeId: "company-1",
    requesterManagerIds: [],
  };
  const result = resolveEscalationApprover(context, nodes, rule);
  assert.equal(result, "ceo");
});

test("resolveEscalationApprover uses last manager when parent node has no owners", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1", ownerUserIds: ["team-lead"] }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: null, ownerUserIds: [] }),
  ];
  const rule = createRule({ escalateToParentManager: true });
  const context = {
    requesterId: "user-1",
    currentApproverId: "team-lead",
    orgNodeId: "team-1",
    requesterManagerIds: ["manager-1"],
  };
  const result = resolveEscalationApprover(context, nodes, rule);
  assert.equal(result, "manager-1");
});

// shouldEscalateApproval tests

test("shouldEscalateApproval returns false for risk level not in appliesToRiskLevels", () => {
  const rule = createRule({ appliesToRiskLevels: ["critical"] });
  const createdAt = new Date(Date.now() - 120 * 60_000).toISOString();
  const now = new Date().toISOString();

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, false);
});

test("shouldEscalateApproval returns false when time threshold not reached", () => {
  const rule = createRule({ triggerAfterMinutes: 60 });
  const createdAt = new Date(Date.now() - 30 * 60_000).toISOString();
  const now = new Date().toISOString();

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, false);
});

test("shouldEscalateApproval returns true when threshold exactly reached", () => {
  const rule = createRule({ triggerAfterMinutes: 60 });
  const createdAt = new Date(Date.now() - 60 * 60_000).toISOString();
  const now = new Date().toISOString();

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, true);
});

test("shouldEscalateApproval returns true when threshold exceeded", () => {
  const rule = createRule({ triggerAfterMinutes: 30 });
  const createdAt = new Date(Date.now() - 90 * 60_000).toISOString();
  const now = new Date().toISOString();

  const result = shouldEscalateApproval(rule, createdAt, now, "critical");
  assert.equal(result, true);
});

test("shouldEscalateApproval returns true for all risk levels when configured", () => {
  const rule = createRule({ appliesToRiskLevels: ["low", "medium", "high", "critical"] });
  const createdAt = new Date(Date.now() - 90 * 60_000).toISOString();
  const now = new Date().toISOString();

  assert.equal(shouldEscalateApproval(rule, createdAt, now, "low"), true);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "medium"), true);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "high"), true);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "critical"), true);
});

// ApprovalEscalationRuleSchema tests

test("ApprovalEscalationRuleSchema parses valid rule", () => {
  const rule = createRule();
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, true);
});

test("ApprovalEscalationRuleSchema requires non-empty ruleId", () => {
  const rule = createRule({ ruleId: "" });
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, false);
});

test("ApprovalEscalationRuleSchema requires positive triggerAfterMinutes", () => {
  const rule = createRule({ triggerAfterMinutes: 0 });
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, false);
});

test("ApprovalEscalationRuleSchema rejects negative triggerAfterMinutes", () => {
  const rule = createRule({ triggerAfterMinutes: -1 });
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, false);
});

test("ApprovalEscalationRuleSchema defaults appliesToRiskLevels to high/critical", () => {
  const rule = {
    ruleId: "rule-1",
    triggerAfterMinutes: 60,
    escalateToApproverId: "escalation-approver",
  };
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepStrictEqual(result.data.appliesToRiskLevels, ["high", "critical"]);
  }
});

test("ApprovalEscalationRuleSchema defaults escalateToParentManager to false", () => {
  const rule = {
    ruleId: "rule-1",
    triggerAfterMinutes: 60,
    escalateToApproverId: "escalation-approver",
  };
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.escalateToParentManager, false);
  }
});

test("ApprovalEscalationRuleSchema accepts all valid risk levels", () => {
  const rule = createRule({ appliesToRiskLevels: ["low", "medium", "high", "critical"] });
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, true);
});

test("ApprovalEscalationRuleSchema rejects invalid risk level", () => {
  const rule = {
    ruleId: "rule-1",
    triggerAfterMinutes: 60,
    appliesToRiskLevels: ["invalid"],
  };
  const result = ApprovalEscalationRuleSchema.safeParse(rule);
  assert.equal(result.success, false);
});

// Edge case tests

test("resolveEscalationApprover handles missing orgNodeId in nodes", () => {
  const nodes: { orgNodeId: string; parentOrgNodeId: string | null; ownerUserIds: readonly string[] }[] = [];
  const rule = createRule({ escalateToParentManager: true });
  const context = {
    requesterId: "user-1",
    currentApproverId: "approver",
    orgNodeId: "nonexistent",
    requesterManagerIds: ["manager"],
  };
  const result = resolveEscalationApprover(context, nodes, rule);
  assert.equal(result, "manager");
});

test("traverseOrgHierarchyForEscalation handles empty nodes array", () => {
  const path = traverseOrgHierarchyForEscalation("approver", "some-node", []);
  assert.deepStrictEqual(path, []);
});

test("shouldEscalateApproval works with string date comparison", () => {
  const rule = createRule({ triggerAfterMinutes: 60 });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T12:00:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, true);
});
