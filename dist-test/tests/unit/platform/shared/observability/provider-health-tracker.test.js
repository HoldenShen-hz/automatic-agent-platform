import assert from "node:assert/strict";
import test from "node:test";
import { ProviderHealthTracker } from "../../../../../src/platform/shared/observability/provider-health-tracker.js";
test("provider health tracker summarizes recent success rate and fallback count", () => {
    const tracker = new ProviderHealthTracker();
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: true,
        latencyMs: 120,
        recordedAt: "2026-04-03T10:00:00.000Z",
    });
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: false,
        latencyMs: 250,
        errorCode: "provider.timeout",
        fallbackProvider: "mock-fallback",
        recordedAt: "2026-04-03T10:01:00.000Z",
    });
    const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
    assert.equal(summary.status, "degraded");
    assert.equal(summary.totalCalls, 2);
    assert.equal(summary.failedCalls, 1);
    assert.equal(summary.fallbackCount, 1);
    assert.equal(summary.successRate, 0.5);
    assert.deepEqual(summary.latestFailureCodes, ["provider.timeout"]);
});
test("provider health tracker returns healthy for all successful attempts", () => {
    const tracker = new ProviderHealthTracker();
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: true,
        latencyMs: 100,
        recordedAt: "2026-04-03T10:00:00.000Z",
    });
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: true,
        latencyMs: 110,
        recordedAt: "2026-04-03T10:01:00.000Z",
    });
    const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
    assert.equal(summary.status, "healthy");
    assert.equal(summary.totalCalls, 2);
    assert.equal(summary.failedCalls, 0);
    assert.equal(summary.successRate, 1.0);
});
test("provider health tracker returns failed for all failed attempts", () => {
    const tracker = new ProviderHealthTracker();
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: false,
        latencyMs: 100,
        errorCode: "provider.error",
        recordedAt: "2026-04-03T10:00:00.000Z",
    });
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: false,
        latencyMs: 110,
        errorCode: "provider.timeout",
        recordedAt: "2026-04-03T10:01:00.000Z",
    });
    const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
    assert.equal(summary.status, "failed");
    assert.equal(summary.totalCalls, 2);
    assert.equal(summary.failedCalls, 2);
    assert.equal(summary.successRate, 0.0);
});
test("provider health tracker returns zero counts for no attempts", () => {
    const tracker = new ProviderHealthTracker();
    const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
    assert.equal(summary.totalCalls, 0);
    assert.equal(summary.failedCalls, 0);
    assert.equal(summary.fallbackCount, 0);
});
test("provider health tracker tracks multiple providers in combined summary", () => {
    const tracker = new ProviderHealthTracker();
    tracker.recordAttempt({
        provider: "provider-a",
        model: "demo-1",
        succeeded: true,
        latencyMs: 100,
        recordedAt: "2026-04-03T10:00:00.000Z",
    });
    tracker.recordAttempt({
        provider: "provider-b",
        model: "demo-2",
        succeeded: false,
        latencyMs: 100,
        errorCode: "provider.error",
        recordedAt: "2026-04-03T10:00:00.000Z",
    });
    const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
    assert.equal(summary.totalCalls, 2);
    assert.equal(summary.failedCalls, 1);
    assert.equal(summary.status, "degraded");
});
test("provider health tracker ignores attempts outside the window", () => {
    const tracker = new ProviderHealthTracker();
    // Attempt from 20 minutes ago (outside 10 minute window)
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: false,
        latencyMs: 100,
        errorCode: "provider.error",
        recordedAt: "2026-04-03T09:45:00.000Z",
    });
    // Attempt from 5 minutes ago (inside window)
    tracker.recordAttempt({
        provider: "mock-primary",
        model: "demo-1",
        succeeded: true,
        latencyMs: 100,
        recordedAt: "2026-04-03T10:00:00.000Z",
    });
    const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
    // Should only count the recent attempt
    assert.equal(summary.totalCalls, 1);
    assert.equal(summary.failedCalls, 0);
    assert.equal(summary.status, "healthy");
});
//# sourceMappingURL=provider-health-tracker.test.js.map