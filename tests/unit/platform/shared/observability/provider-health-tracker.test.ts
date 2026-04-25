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

test("provider health tracker recordAttempt returns the recorded attempt", () => {
  const tracker = new ProviderHealthTracker();

  const record = {
    provider: "mock-primary",
    model: "demo-1",
    succeeded: true,
    latencyMs: 100,
    recordedAt: "2026-04-03T10:00:00.000Z",
  };

  const result = tracker.recordAttempt(record);
  assert.equal(result, record);
  assert.equal(result.provider, "mock-primary");
  assert.equal(result.succeeded, true);
});

test("provider health tracker limits latestFailureCodes to 5", () => {
  const tracker = new ProviderHealthTracker();

  for (let i = 0; i < 10; i++) {
    tracker.recordAttempt({
      provider: "mock-primary",
      model: "demo-1",
      succeeded: false,
      latencyMs: 100,
      errorCode: `error.${i}`,
      recordedAt: `2026-04-03T10:${String(i).padStart(2, "0")}:00.000Z`,
    });
  }

  const summary = tracker.getSummary(60 * 60_000, "2026-04-03T11:00:00.000Z");

  assert.equal(summary.latestFailureCodes.length, 5);
  assert.deepEqual(summary.latestFailureCodes, ["error.5", "error.6", "error.7", "error.8", "error.9"]);
});

test("provider health tracker respects custom retentionLimit", () => {
  const tracker = new ProviderHealthTracker({ retentionLimit: 3 });

  for (let i = 0; i < 5; i++) {
    tracker.recordAttempt({
      provider: "mock-primary",
      model: "demo-1",
      succeeded: true,
      latencyMs: 100,
      recordedAt: `2026-04-03T10:${String(i).padStart(2, "0")}:00.000Z`,
    });
  }

  const summary = tracker.getSummary(60 * 60_000, "2026-04-03T11:00:00.000Z");
  assert.equal(summary.totalCalls, 3);
});

test("provider health tracker uses custom degradedThreshold", () => {
  const tracker = new ProviderHealthTracker({ degradedThreshold: 0.9 });

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
    succeeded: false,
    latencyMs: 100,
    recordedAt: "2026-04-03T10:01:00.000Z",
  });

  const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
  assert.equal(summary.status, "degraded");
  assert.equal(summary.successRate, 0.5);
});

test("provider health tracker uses custom failedThreshold", () => {
  const tracker = new ProviderHealthTracker({ failedThreshold: 0.3 });

  tracker.recordAttempt({
    provider: "mock-primary",
    model: "demo-1",
    succeeded: false,
    latencyMs: 100,
    recordedAt: "2026-04-03T10:00:00.000Z",
  });
  tracker.recordAttempt({
    provider: "mock-primary",
    model: "demo-1",
    succeeded: true,
    latencyMs: 100,
    recordedAt: "2026-04-03T10:01:00.000Z",
  });

  const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
  // successRate = 0.5, which is >= failedThreshold (0.3), so status is degraded not failed
  assert.equal(summary.status, "degraded");
});

test("provider health tracker returns failed when below custom failedThreshold", () => {
  const tracker = new ProviderHealthTracker({ failedThreshold: 0.6 });

  tracker.recordAttempt({
    provider: "mock-primary",
    model: "demo-1",
    succeeded: false,
    latencyMs: 100,
    recordedAt: "2026-04-03T10:00:00.000Z",
  });
  tracker.recordAttempt({
    provider: "mock-primary",
    model: "demo-1",
    succeeded: true,
    latencyMs: 100,
    recordedAt: "2026-04-03T10:01:00.000Z",
  });

  const summary = tracker.getSummary(10 * 60_000, "2026-04-03T10:05:00.000Z");
  // successRate = 0.5, which is < failedThreshold (0.6), so status is failed
  assert.equal(summary.status, "failed");
});
