import assert from "node:assert/strict";
import test from "node:test";
test("ProviderAttemptRecord structure is correct", () => {
    const record = {
        provider: "anthropic",
        model: "claude-3-5-sonnet",
        succeeded: true,
        latencyMs: 1500,
        recordedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.provider, "anthropic");
    assert.equal(record.model, "claude-3-5-sonnet");
    assert.equal(record.succeeded, true);
    assert.equal(record.latencyMs, 1500);
});
test("ProviderAttemptRecord allows optional errorCode", () => {
    const record = {
        provider: "anthropic",
        model: "claude-3-5-sonnet",
        succeeded: false,
        latencyMs: 3000,
        recordedAt: "2026-04-14T00:00:00.000Z",
        errorCode: "rate_limit_exceeded",
    };
    assert.equal(record.succeeded, false);
    assert.equal(record.errorCode, "rate_limit_exceeded");
});
test("ProviderAttemptRecord allows optional fallbackProvider", () => {
    const record = {
        provider: "openai",
        model: "gpt-4",
        succeeded: true,
        latencyMs: 2000,
        recordedAt: "2026-04-14T00:00:00.000Z",
        fallbackProvider: "anthropic",
    };
    assert.equal(record.fallbackProvider, "anthropic");
});
test("ProviderHealthSummary structure is correct", () => {
    const summary = {
        status: "healthy",
        successRate: 0.95,
        totalCalls: 100,
        failedCalls: 5,
        fallbackCount: 2,
        latestFailureCodes: ["rate_limit_exceeded"],
    };
    assert.equal(summary.status, "healthy");
    assert.equal(summary.successRate, 0.95);
    assert.equal(summary.totalCalls, 100);
    assert.equal(summary.failedCalls, 5);
});
test("ProviderHealthSummary status can be degraded", () => {
    const summary = {
        status: "degraded",
        successRate: 0.7,
        totalCalls: 100,
        failedCalls: 30,
        fallbackCount: 10,
        latestFailureCodes: ["timeout", "rate_limit"],
    };
    assert.equal(summary.status, "degraded");
});
test("ProviderHealthSummary status can be failed", () => {
    const summary = {
        status: "failed",
        successRate: 0.1,
        totalCalls: 100,
        failedCalls: 90,
        fallbackCount: 50,
        latestFailureCodes: ["api_error", "auth_failure"],
    };
    assert.equal(summary.status, "failed");
});
test("ProviderHealthSummary latestFailureCodes can be empty", () => {
    const summary = {
        status: "healthy",
        successRate: 1.0,
        totalCalls: 50,
        failedCalls: 0,
        fallbackCount: 0,
        latestFailureCodes: [],
    };
    assert.equal(summary.latestFailureCodes.length, 0);
});
test("ProviderHealthTrackerOptions has correct defaults", () => {
    const options = {};
    assert.equal(options.retentionLimit, undefined);
    assert.equal(options.degradedThreshold, undefined);
    assert.equal(options.failedThreshold, undefined);
});
test("ProviderHealthTrackerOptions allows custom values", () => {
    const options = {
        retentionLimit: 1000,
        degradedThreshold: 0.9,
        failedThreshold: 0.6,
    };
    assert.equal(options.retentionLimit, 1000);
    assert.equal(options.degradedThreshold, 0.9);
    assert.equal(options.failedThreshold, 0.6);
});
//# sourceMappingURL=provider-health-tracker-types.test.js.map