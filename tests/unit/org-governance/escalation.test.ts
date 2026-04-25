/**
 * Unit tests for approval-routing/escalation module
 *
 * @see src/org-governance/approval-routing/escalation/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ApprovalEscalationRuleSchema,
  shouldEscalateApproval,
  type ApprovalEscalationRule,
} from "../../../src/org-governance/approval-routing/escalation/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ApprovalEscalationRuleSchema validates valid rule", () => {
  const rule = ApprovalEscalationRuleSchema.parse({
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["high", "critical"],
  });

  assert.equal(rule.ruleId, "esc-1");
  assert.equal(rule.triggerAfterMinutes, 30);
  assert.equal(rule.escalateToApproverId, "vp-ops");
  assert.deepStrictEqual(rule.appliesToRiskLevels, ["high", "critical"]);
});

test("ApprovalEscalationRuleSchema applies defaults", () => {
  const rule = ApprovalEscalationRuleSchema.parse({
    ruleId: "esc-1",
    triggerAfterMinutes: 60,
    escalateToApproverId: "manager",
  });

  assert.deepStrictEqual(rule.appliesToRiskLevels, ["high", "critical"]);
});

test("ApprovalEscalationRuleSchema rejects empty ruleId", () => {
  assert.throws(() => ApprovalEscalationRuleSchema.parse({
    ruleId: "",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
  }));
});

test("ApprovalEscalationRuleSchema rejects non-positive triggerAfterMinutes", () => {
  assert.throws(() => ApprovalEscalationRuleSchema.parse({
    ruleId: "esc-1",
    triggerAfterMinutes: 0,
    escalateToApproverId: "vp-ops",
  }));

  assert.throws(() => ApprovalEscalationRuleSchema.parse({
    ruleId: "esc-1",
    triggerAfterMinutes: -1,
    escalateToApproverId: "vp-ops",
  }));
});

test("ApprovalEscalationRuleSchema validates riskLevel enum in appliesToRiskLevels", () => {
  const rule = ApprovalEscalationRuleSchema.parse({
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["low", "medium", "high", "critical"],
  });

  assert.deepStrictEqual(rule.appliesToRiskLevels, ["low", "medium", "high", "critical"]);
});

test("ApprovalEscalationRuleSchema rejects invalid riskLevel in appliesToRiskLevels", () => {
  assert.throws(() => ApprovalEscalationRuleSchema.parse({
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["invalid"],
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
// shouldEscalateApproval Tests
// ─────────────────────────────────────────────────────────────────────────────

test("shouldEscalateApproval returns true when time threshold exceeded and risk matches", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["high", "critical"],
  };

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T00:45:00.000Z"; // 45 minutes later

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, true);
});

test("shouldEscalateApproval returns false when time threshold not exceeded", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["high", "critical"],
  };

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T00:15:00.000Z"; // Only 15 minutes later

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, false);
});

test("shouldEscalateApproval returns false when risk level does not match", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["high", "critical"],
  };

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T01:00:00.000Z"; // Time threshold exceeded

  const result = shouldEscalateApproval(rule, createdAt, now, "low");
  assert.equal(result, false);
});

test("shouldEscalateApproval returns true at exactly the threshold", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["high", "critical"],
  };

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T00:30:00.000Z"; // Exactly 30 minutes

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, true);
});

test("shouldEscalateApproval handles all risk levels", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["low", "medium", "high", "critical"],
  };

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T01:00:00.000Z";

  assert.equal(shouldEscalateApproval(rule, createdAt, now, "low"), true);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "medium"), true);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "high"), true);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "critical"), true);
});

test("shouldEscalateApproval handles appliesToRiskLevels with single value", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "esc-1",
    triggerAfterMinutes: 30,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["critical"], // Only critical triggers escalation
  };

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T01:00:00.000Z";

  assert.equal(shouldEscalateApproval(rule, createdAt, now, "critical"), true);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "high"), false);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "medium"), false);
  assert.equal(shouldEscalateApproval(rule, createdAt, now, "low"), false);
});

test("shouldEscalateApproval handles edge case at boundary", () => {
  const rule: ApprovalEscalationRule = {
    ruleId: "esc-1",
    triggerAfterMinutes: 60,
    escalateToApproverId: "vp-ops",
    appliesToRiskLevels: ["high", "critical"],
  };

  const createdAt = "2026-04-20T00:00:00.000Z";
  const now = "2026-04-20T00:59:59.999Z"; // Just before 60 minutes

  const result = shouldEscalateApproval(rule, createdAt, now, "high");
  assert.equal(result, false);
});
