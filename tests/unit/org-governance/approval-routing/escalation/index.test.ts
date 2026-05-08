/**
 * Unit tests for Approval Escalation
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { shouldEscalateApproval, type ApprovalEscalationRule } from "../../../../../src/org-governance/approval-routing/escalation/index.js";

function createRule(overrides: Partial<{
  ruleId: string;
  triggerAfterMinutes: number;
  escalateToApproverId: string;
  appliesToRiskLevels: ("low" | "medium" | "high" | "critical")[];
}> = {}): ApprovalEscalationRule {
  return {
    ruleId: "rule-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "escalation-manager",
    appliesToRiskLevels: ["high", "critical"],
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
