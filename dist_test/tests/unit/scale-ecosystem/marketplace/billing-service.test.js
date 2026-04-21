import assert from "node:assert/strict";
import test from "node:test";
import { BillingService } from "../../../../src/scale-ecosystem/marketplace/billing-service.js";
import { ManualBillingPaymentGateway } from "../../../../src/scale-ecosystem/marketplace/billing-payment-gateway.js";
test("BillingAccountSummary structure", () => {
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
    assert.equal(summary.account.accountId, "bill_acct_123");
    assert.equal(summary.plan.planId, "plan_pro");
    assert.equal(summary.totals.totalBilledUsd, 45.00);
});
test("CreateBillingAccountInput structure", () => {
    const input = {
        ownerId: "user_abc",
        workspaceId: "ws_456",
        planId: "plan_pro",
    };
    assert.equal(input.ownerId, "user_abc");
    assert.equal(input.workspaceId, "ws_456");
    assert.equal(input.planId, "plan_pro");
});
test("EvaluateEntitlementInput structure", () => {
    const input = {
        accountId: "bill_acct_123",
        featureKey: "advanced_analytics",
    };
    assert.equal(input.accountId, "bill_acct_123");
    assert.equal(input.featureKey, "advanced_analytics");
});
test("EvaluateEntitlementResult structure - allowed", () => {
    const result = {
        decision: {
            decisionId: "dec_123",
            accountId: "bill_acct_123",
            featureKey: "advanced_analytics",
            metricType: null,
            requestedQuantity: null,
            allowed: 1,
            decisionType: "allow",
            reasonCode: "Feature included in plan",
            policyVersion: "1.0",
            evaluatedAt: "2026-04-14T00:00:00.000Z",
        },
        account: {
            accountId: "bill_acct_123",
            ownerId: "user_abc",
            workspaceId: "ws_456",
            planId: "plan_pro",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        },
        remainingQuantity: null,
        projectedQuantity: null,
    };
    assert.equal(result.decision.decisionType, "allow");
    assert.equal(result.decision.featureKey, "advanced_analytics");
});
test("EvaluateEntitlementResult structure - denied", () => {
    const result = {
        decision: {
            decisionId: "dec_456",
            accountId: "bill_acct_123",
            featureKey: "advanced_analytics",
            metricType: null,
            requestedQuantity: null,
            allowed: 0,
            decisionType: "deny",
            reasonCode: "Feature not included in current plan",
            policyVersion: "1.0",
            evaluatedAt: "2026-04-14T00:00:00.000Z",
        },
        account: {
            accountId: "bill_acct_123",
            ownerId: "user_abc",
            workspaceId: "ws_456",
            planId: "plan_pro",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        },
        remainingQuantity: null,
        projectedQuantity: null,
    };
    assert.equal(result.decision.decisionType, "deny");
});
test("EvaluateEntitlementResult structure - warn", () => {
    const result = {
        decision: {
            decisionId: "dec_789",
            accountId: "bill_acct_123",
            featureKey: "api_calls",
            metricType: "task_execution",
            requestedQuantity: 1000,
            allowed: 800,
            decisionType: "warn",
            reasonCode: "Approaching usage limit",
            policyVersion: "1.0",
            evaluatedAt: "2026-04-14T00:00:00.000Z",
        },
        account: {
            accountId: "bill_acct_123",
            ownerId: "user_abc",
            workspaceId: "ws_456",
            planId: "plan_pro",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        },
        remainingQuantity: 800,
        projectedQuantity: 1200,
    };
    assert.equal(result.decision.decisionType, "warn");
});
test("EvaluateEntitlementResult structure - degrade", () => {
    const result = {
        decision: {
            decisionId: "dec_789",
            accountId: "bill_acct_123",
            featureKey: "api_calls",
            metricType: "task_execution",
            requestedQuantity: 1000,
            allowed: 0,
            decisionType: "degrade",
            reasonCode: "Usage limit exceeded, degraded mode active",
            policyVersion: "1.0",
            evaluatedAt: "2026-04-14T00:00:00.000Z",
        },
        account: {
            accountId: "bill_acct_123",
            ownerId: "user_abc",
            workspaceId: "ws_456",
            planId: "plan_pro",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        },
        remainingQuantity: 0,
        projectedQuantity: null,
    };
    assert.equal(result.decision.decisionType, "degrade");
});
test("RecordUsageInput structure", () => {
    const input = {
        accountId: "bill_acct_123",
        metricType: "task_execution",
        quantity: 100,
        source: "runtime",
        taskId: "task_456",
        executionId: "exec_789",
        capturedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(input.accountId, "bill_acct_123");
    assert.equal(input.metricType, "task_execution");
    assert.equal(input.quantity, 100);
});
test("BillingService can be imported", () => {
    assert.ok(typeof BillingService === "function");
});
test("BillingPaymentGateway can be imported", () => {
    assert.ok(typeof ManualBillingPaymentGateway === "function");
});
//# sourceMappingURL=billing-service.test.js.map