import assert from "node:assert/strict";
import test from "node:test";
import { FinanceAccountingTaskTypeSchema, FINANCE_ACCOUNTING_DOMAIN_PRESET, requiresFinanceAccountingReview, } from "../../../../src/domains/finance-accounting/index.js";
test("FinanceAccountingTaskTypeSchema accepts valid task types", () => {
    const types = ["reconcile", "report", "forecast"];
    for (const type of types) {
        const result = FinanceAccountingTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("FinanceAccountingTaskTypeSchema rejects invalid task types", () => {
    const result = FinanceAccountingTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("FINANCE_ACCOUNTING_DOMAIN_PRESET has correct structure", () => {
    assert.equal(FINANCE_ACCOUNTING_DOMAIN_PRESET.domainId, "finance-accounting");
    assert.ok(Array.isArray(FINANCE_ACCOUNTING_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(FINANCE_ACCOUNTING_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(FINANCE_ACCOUNTING_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(FINANCE_ACCOUNTING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("FINANCE_ACCOUNTING_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(FINANCE_ACCOUNTING_DOMAIN_PRESET.requiredCapabilities, ["reconcile", "report", "forecast"]);
});
test("FINANCE_ACCOUNTING_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(FINANCE_ACCOUNTING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["report", "forecast"]);
});
test("requiresFinanceAccountingReview returns true for report task type", () => {
    assert.equal(requiresFinanceAccountingReview("report"), true);
});
test("requiresFinanceAccountingReview returns true for forecast task type", () => {
    assert.equal(requiresFinanceAccountingReview("forecast"), true);
});
test("requiresFinanceAccountingReview returns false for reconcile task type", () => {
    assert.equal(requiresFinanceAccountingReview("reconcile"), false);
});
//# sourceMappingURL=index.test.js.map