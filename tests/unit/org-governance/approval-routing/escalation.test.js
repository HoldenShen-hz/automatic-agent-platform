/**
 * Unit tests for Approval Escalation functions
 *
 * @see src/org-governance/approval-routing/escalation/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalEscalationRuleSchema, shouldEscalateApproval, } from "../../../../src/org-governance/approval-routing/escalation/index.js";
function createRule(overrides = {}) {
    return {
        ruleId: overrides.ruleId ?? "rule-1",
        triggerAfterMinutes: overrides.triggerAfterMinutes ?? 60,
        escalateToApproverId: overrides.escalateToApproverId ?? "escalation-approver",
        appliesToRiskLevels: overrides.appliesToRiskLevels ?? ["high", "critical"],
        ...overrides,
    };
}
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
test("ApprovalEscalationRuleSchema requires non-negative triggerAfterMinutes (not negative)", () => {
    const rule = createRule({ triggerAfterMinutes: -1 });
    const result = ApprovalEscalationRuleSchema.safeParse(rule);
    assert.equal(result.success, false);
});
test("ApprovalEscalationRuleSchema requires non-empty escalateToApproverId", () => {
    const rule = createRule({ escalateToApproverId: "" });
    const result = ApprovalEscalationRuleSchema.safeParse(rule);
    assert.equal(result.success, false);
});
test("ApprovalEscalationRuleSchema has correct defaults for appliesToRiskLevels", () => {
    const rule = {
        ruleId: "rule-1",
        triggerAfterMinutes: 60,
        escalateToApproverId: "escalation-approver",
    };
    const result = ApprovalEscalationRuleSchema.safeParse(rule);
    assert.equal(result.success, true);
    if (result.success) {
        assert.deepEqual(result.data.appliesToRiskLevels, ["high", "critical"]);
    }
});
test("shouldEscalateApproval returns false when risk level not in appliesToRiskLevels", () => {
    const rule = createRule({ appliesToRiskLevels: ["critical"] });
    const createdAt = new Date(Date.now() - 120 * 60_000).toISOString();
    const now = new Date().toISOString();
    const result = shouldEscalateApproval(rule, createdAt, now, "low");
    assert.equal(result, false);
});
test("shouldEscalateApproval returns false when time threshold not reached", () => {
    const rule = createRule({ triggerAfterMinutes: 60 });
    const createdAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const now = new Date().toISOString();
    const result = shouldEscalateApproval(rule, createdAt, now, "high");
    assert.equal(result, false);
});
test("shouldEscalateApproval returns true when risk level matches and time threshold reached", () => {
    const rule = createRule({ triggerAfterMinutes: 60, appliesToRiskLevels: ["high", "critical"] });
    const createdAt = new Date(Date.now() - 90 * 60_000).toISOString();
    const now = new Date().toISOString();
    const result = shouldEscalateApproval(rule, createdAt, now, "high");
    assert.equal(result, true);
});
test("shouldEscalateApproval returns true for critical risk when threshold reached", () => {
    const rule = createRule({ triggerAfterMinutes: 30, appliesToRiskLevels: ["critical"] });
    const createdAt = new Date(Date.now() - 45 * 60_000).toISOString();
    const now = new Date().toISOString();
    const result = shouldEscalateApproval(rule, createdAt, now, "critical");
    assert.equal(result, true);
});
test("shouldEscalateApproval returns false for medium risk when only high/critical apply", () => {
    const rule = createRule({ triggerAfterMinutes: 30, appliesToRiskLevels: ["high", "critical"] });
    const createdAt = new Date(Date.now() - 45 * 60_000).toISOString();
    const now = new Date().toISOString();
    const result = shouldEscalateApproval(rule, createdAt, now, "medium");
    assert.equal(result, false);
});
test("shouldEscalateApproval returns true exactly at threshold", () => {
    const triggerAfterMinutes = 60;
    const createdAt = new Date(Date.now() - triggerAfterMinutes * 60_000).toISOString();
    const now = new Date().toISOString();
    const rule = createRule({ triggerAfterMinutes });
    const result = shouldEscalateApproval(rule, createdAt, now, "high");
    assert.equal(result, true);
});
test("shouldEscalateApproval handles all risk levels in appliesToRiskLevels", () => {
    const rule = createRule({ appliesToRiskLevels: ["low", "medium", "high", "critical"] });
    const createdAt = new Date(Date.now() - 90 * 60_000).toISOString();
    const now = new Date().toISOString();
    assert.equal(shouldEscalateApproval(rule, createdAt, now, "low"), true);
    assert.equal(shouldEscalateApproval(rule, createdAt, now, "medium"), true);
    assert.equal(shouldEscalateApproval(rule, createdAt, now, "high"), true);
    assert.equal(shouldEscalateApproval(rule, createdAt, now, "critical"), true);
});
//# sourceMappingURL=escalation.test.js.map