/**
 * Unit tests for Approval Escalation
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  evaluateApprovalEscalation,
  shouldEscalateApproval,
  traverseOrgHierarchy,
  type ApprovalEscalationRule,
} from "../../../../../src/org-governance/approval-routing/escalation/index.js";

function createRule(overrides: Partial<{
  ruleId: string;
  triggerAfterMinutes: number;
  escalateToApproverId: string;
  appliesToRiskLevels: ("low" | "medium" | "high" | "critical")[];
  maxEscalationDepth: number;
  cooldownMinutes: number;
  notifyOnSlaBreach: boolean;
  slaBreachNotificationTargetIds: string[];
}> = {}): ApprovalEscalationRule {
  return {
    ruleId: "rule-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "escalation-manager",
    appliesToRiskLevels: ["high", "critical"],
    maxEscalationDepth: 1,
    cooldownMinutes: 0,
    notifyOnSlaBreach: false,
    slaBreachNotificationTargetIds: [],
    ...overrides,
  };
}

test("shouldEscalateApproval returns false for risk level not in appliesToRiskLevels", () => {
  const rule = createRule({ appliesToRiskLevels: ["critical"] });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T10:31:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "high");

  assert.strictEqual(result, false);
});

test("shouldEscalateApproval returns false when time threshold not reached", () => {
  const rule = createRule({ triggerAfterMinutes: 30 });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T10:29:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "high");

  assert.strictEqual(result, false);
});

test("shouldEscalateApproval returns true when time threshold exactly reached", () => {
  const rule = createRule({ triggerAfterMinutes: 30 });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T10:30:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "high");

  assert.strictEqual(result, true);
});

test("shouldEscalateApproval returns true when time threshold exceeded", () => {
  const rule = createRule({ triggerAfterMinutes: 30 });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T11:00:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "high");

  assert.strictEqual(result, true);
});

test("shouldEscalateApproval returns true for critical risk level", () => {
  const rule = createRule({ appliesToRiskLevels: ["high", "critical"] });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T11:00:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "critical");

  assert.strictEqual(result, true);
});

test("shouldEscalateApproval returns false for low risk level when rule applies only to high/critical", () => {
  const rule = createRule({ appliesToRiskLevels: ["high", "critical"] });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T11:00:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "low");

  assert.strictEqual(result, false);
});

test("shouldEscalateApproval returns false for medium risk level when rule applies only to high/critical", () => {
  const rule = createRule({ appliesToRiskLevels: ["high", "critical"] });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T11:00:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "medium");

  assert.strictEqual(result, false);
});

test("shouldEscalateApproval handles zero triggerAfterMinutes", () => {
  const rule = createRule({ triggerAfterMinutes: 0 });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T10:00:00Z";

  const result = shouldEscalateApproval(rule, createdAt, now, "high");

  assert.strictEqual(result, true);
});

test("shouldEscalateApproval works with default appliesToRiskLevels", () => {
  const rule = createRule();
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T11:00:00Z";

  // Default is ["high", "critical"]
  assert.strictEqual(rule.appliesToRiskLevels.includes("high"), true);
  assert.strictEqual(shouldEscalateApproval(rule, createdAt, now, "high"), true);
});

test("shouldEscalateApproval works with all risk levels", () => {
  const rule = createRule({ appliesToRiskLevels: ["low", "medium", "high", "critical"] });
  const createdAt = "2025-01-01T10:00:00Z";
  const now = "2025-01-01T11:00:00Z";

  assert.strictEqual(shouldEscalateApproval(rule, createdAt, now, "low"), true);
  assert.strictEqual(shouldEscalateApproval(rule, createdAt, now, "medium"), true);
  assert.strictEqual(shouldEscalateApproval(rule, createdAt, now, "high"), true);
  assert.strictEqual(shouldEscalateApproval(rule, createdAt, now, "critical"), true);
});

test("evaluateApprovalEscalation enforces max escalation depth", () => {
  const decision = evaluateApprovalEscalation(
    createRule({ maxEscalationDepth: 1 }),
    "2025-01-01T10:00:00Z",
    "2025-01-01T11:00:00Z",
    "high",
    { escalationDepth: 1 },
  );

  assert.strictEqual(decision.shouldEscalate, false);
  assert.strictEqual(decision.reason, "max_depth_reached");
});

test("evaluateApprovalEscalation enforces cooldown between repeated escalations", () => {
  const decision = evaluateApprovalEscalation(
    createRule({ cooldownMinutes: 30, maxEscalationDepth: 2 }),
    "2025-01-01T10:00:00Z",
    "2025-01-01T11:00:00Z",
    "high",
    {
      escalationDepth: 1,
      lastEscalatedAtIso: "2025-01-01T10:45:00Z",
    },
  );

  assert.strictEqual(decision.shouldEscalate, false);
  assert.strictEqual(decision.reason, "cooldown_active");
});

test("evaluateApprovalEscalation returns SLA breach notification targets when enabled", () => {
  const decision = evaluateApprovalEscalation(
    createRule({
      notifyOnSlaBreach: true,
      slaBreachNotificationTargetIds: ["compliance", "oncall-manager"],
      maxEscalationDepth: 2,
    }),
    "2025-01-01T10:00:00Z",
    "2025-01-01T11:00:00Z",
    "high",
    {
      escalationDepth: 0,
      slaBreached: true,
    },
  );

  assert.strictEqual(decision.shouldEscalate, true);
  assert.strictEqual(decision.shouldNotifySlaBreach, true);
  assert.deepStrictEqual(decision.notificationTargetIds, ["compliance", "oncall-manager"]);
});

test("traverseOrgHierarchy walks up to the nearest owner when the current node has none", () => {
  const target = traverseOrgHierarchy(
    "team-a",
    [
      { orgNodeId: "team-a", parentOrgNodeId: "dept-a", ownerUserIds: [] },
      { orgNodeId: "dept-a", parentOrgNodeId: "org-root", ownerUserIds: ["director-1"] },
      { orgNodeId: "org-root", parentOrgNodeId: null, ownerUserIds: ["vp-1"] },
    ],
    3,
  );

  assert.strictEqual(target, "director-1");
});

test("evaluateApprovalEscalation uses hierarchy fallback for SLA notification targets", () => {
  const decision = evaluateApprovalEscalation(
    createRule({
      notifyOnSlaBreach: true,
      slaBreachNotificationTargetIds: [],
      maxEscalationDepth: 3,
    }),
    "2025-01-01T10:00:00Z",
    "2025-01-01T11:00:00Z",
    "high",
    {
      slaBreached: true,
      orgNodeId: "team-a",
      orgNodes: [
        { orgNodeId: "team-a", parentOrgNodeId: "dept-a", ownerUserIds: [] },
        { orgNodeId: "dept-a", parentOrgNodeId: null, ownerUserIds: ["director-1"] },
      ],
    },
  );

  assert.strictEqual(decision.shouldEscalate, true);
  assert.strictEqual(decision.shouldNotifySlaBreach, true);
  assert.deepStrictEqual(decision.notificationTargetIds, ["director-1"]);
});

test("evaluateApprovalEscalation ignores invalid cooldown timestamps and null hierarchy targets", () => {
  const decision = evaluateApprovalEscalation(
    createRule({
      cooldownMinutes: 15,
      notifyOnSlaBreach: true,
      slaBreachNotificationTargetIds: [],
      maxEscalationDepth: 2,
    }),
    "2025-01-01T10:00:00Z",
    "2025-01-01T11:00:00Z",
    "high",
    {
      slaBreached: true,
      lastEscalatedAtIso: "not-a-timestamp",
      orgNodeId: "team-a",
      orgNodes: [
        { orgNodeId: "team-a", parentOrgNodeId: "dept-a", ownerUserIds: [] },
        { orgNodeId: "dept-a", parentOrgNodeId: null, ownerUserIds: [] },
      ],
    },
  );

  assert.strictEqual(decision.shouldEscalate, true);
  assert.strictEqual(decision.shouldNotifySlaBreach, false);
  assert.deepStrictEqual(decision.notificationTargetIds, []);
  assert.strictEqual(decision.reason, "eligible");
});
