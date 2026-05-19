import assert from "node:assert/strict";
import test from "node:test";
import { assertIdentifier, assertPositiveNumber, roundCurrency, monthWindow, buildBillingMarkdown, } from "../../../../src/scale-ecosystem/marketplace/billing/utils.js";
test("assertIdentifier accepts valid identifiers", () => {
    assert.equal(assertIdentifier("valid", "test.invalid"), "valid");
    assert.equal(assertIdentifier("valid_name", "test.invalid"), "valid_name");
    assert.equal(assertIdentifier("valid-name", "test.invalid"), "valid-name");
    assert.equal(assertIdentifier("valid.name", "test.invalid"), "valid.name");
    assert.equal(assertIdentifier("valid:name", "test.invalid"), "valid:name");
    assert.equal(assertIdentifier("valid_123", "test.invalid"), "valid_123");
    assert.equal(assertIdentifier("a1", "test.invalid"), "a1"); // min 2 chars
});
test("assertIdentifier throws for invalid identifiers", () => {
    assert.throws(() => assertIdentifier("", "test.invalid"), (e) => e.code === "test.invalid");
    assert.throws(() => assertIdentifier("a", "test.invalid"), // too short
    (e) => e.code === "test.invalid");
    assert.throws(() => assertIdentifier("invalid name", "test.invalid"), // space
    (e) => e.code === "test.invalid");
    assert.throws(() => assertIdentifier("invalid@name", "test.invalid"), // special char
    (e) => e.code === "test.invalid");
    assert.throws(() => assertIdentifier("a".repeat(129), "test.invalid"), // too long
    (e) => e.code === "test.invalid");
});
test("assertIdentifier throws for invalid special characters", () => {
    // Space is not allowed
    assert.throws(() => assertIdentifier("invalid name", "test.invalid"), (e) => e.code === "test.invalid");
    // @ is not allowed
    assert.throws(() => assertIdentifier("invalid@name", "test.invalid"), (e) => e.code === "test.invalid");
    // # is not allowed
    assert.throws(() => assertIdentifier("test#name", "test.invalid"), (e) => e.code === "test.invalid");
});
test("assertPositiveNumber accepts positive numbers", () => {
    assert.equal(assertPositiveNumber(1, "test.invalid"), 1);
    assert.equal(assertPositiveNumber(0.5, "test.invalid"), 0.5);
    assert.equal(assertPositiveNumber(100, "test.invalid"), 100);
    assert.equal(assertPositiveNumber(0.001, "test.invalid"), 0.001);
});
test("assertPositiveNumber throws for zero", () => {
    assert.throws(() => assertPositiveNumber(0, "test.invalid"), (e) => e.code === "test.invalid");
});
test("assertPositiveNumber throws for negative numbers", () => {
    assert.throws(() => assertPositiveNumber(-1, "test.invalid"), (e) => e.code === "test.invalid");
    assert.throws(() => assertPositiveNumber(-0.5, "test.invalid"), (e) => e.code === "test.invalid");
});
test("assertPositiveNumber throws for non-finite values", () => {
    assert.throws(() => assertPositiveNumber(Infinity, "test.invalid"), (e) => e.code === "test.invalid");
    assert.throws(() => assertPositiveNumber(-Infinity, "test.invalid"), (e) => e.code === "test.invalid");
    assert.throws(() => assertPositiveNumber(NaN, "test.invalid"), (e) => e.code === "test.invalid");
});
test("roundCurrency rounds to 4 decimal places", () => {
    assert.equal(roundCurrency(1.12345), 1.1235);
    assert.equal(roundCurrency(1.12344), 1.1234);
    assert.equal(roundCurrency(1.123456789), 1.1235);
});
test("roundCurrency handles integers", () => {
    assert.equal(roundCurrency(100), 100);
});
test("roundCurrency handles negative numbers", () => {
    assert.equal(roundCurrency(-1.12345), -1.1234);
});
test("roundCurrency handles zero", () => {
    assert.equal(roundCurrency(0), 0);
});
test("monthWindow parses valid timestamp", () => {
    const result = monthWindow("2026-04-14T00:00:00.000Z");
    assert.equal(result.periodId, "2026-04");
    assert.ok(result.start.includes("2026-04-01"));
    assert.ok(result.end.includes("2026-05-01"));
});
test("monthWindow handles month boundary", () => {
    const result = monthWindow("2026-12-15T00:00:00.000Z");
    assert.equal(result.periodId, "2026-12");
    assert.ok(result.start.includes("2026-12-01"));
    assert.ok(result.end.includes("2027-01-01"));
});
test("monthWindow throws for invalid timestamp", () => {
    assert.throws(() => monthWindow("invalid"), (e) => e.code === "billing.invalid_timestamp");
    assert.throws(() => monthWindow("not-a-date"), (e) => e.code === "billing.invalid_timestamp");
});
test("buildBillingMarkdown generates correct markdown", () => {
    const summary = {
        account: {
            accountId: "bill_acct_123",
            ownerId: "user_abc",
            workspaceId: "ws_456",
            planId: "plan_pro",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        },
        plan: {
            planId: "plan_pro",
            displayName: "Pro Plan",
            features: [],
            quotas: {},
        },
        generatedAt: "2026-04-14T00:00:00.000Z",
        totals: {
            usageEventCount: 100,
            ledgerEntryCount: 50,
            totalBilledUsd: 45.00,
        },
        quotas: [],
        recentUsage: [],
        recentLedgerEntries: [],
        recentDecisions: [],
    };
    const markdown = buildBillingMarkdown(summary);
    assert.ok(markdown.includes("# Billing Account Summary"));
    assert.ok(markdown.includes("bill_acct_123"));
    assert.ok(markdown.includes("plan_pro"));
    assert.ok(markdown.includes("active"));
    assert.ok(markdown.includes("100")); // usageEventCount
    assert.ok(markdown.includes("50")); // ledgerEntryCount
    assert.ok(markdown.includes("45")); // totalBilledUsd
});
test("buildBillingMarkdown includes quota details", () => {
    const summary = {
        account: {
            accountId: "bill_acct_123",
            ownerId: "user_abc",
            workspaceId: "ws_456",
            planId: "plan_pro",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        },
        plan: {
            planId: "plan_pro",
            displayName: "Pro Plan",
            features: [],
            quotas: {},
        },
        generatedAt: "2026-04-14T00:00:00.000Z",
        totals: {
            usageEventCount: 0,
            ledgerEntryCount: 0,
            totalBilledUsd: 0,
        },
        quotas: [
            {
                metricType: "task_execution",
                usedQuantity: 500,
                limitQuantity: 1000,
                remainingQuantity: 500,
                limitType: "hard",
                windowStart: "2026-04-01T00:00:00.000Z",
                windowEnd: "2026-04-30T23:59:59.999Z",
            },
        ],
        recentUsage: [],
        recentLedgerEntries: [],
        recentDecisions: [],
    };
    const markdown = buildBillingMarkdown(summary);
    assert.ok(markdown.includes("## Quotas"));
    assert.ok(markdown.includes("task_execution"));
    assert.ok(markdown.includes("used=500"));
    assert.ok(markdown.includes("limit=1000"));
});
//# sourceMappingURL=billing-utils.test.js.map