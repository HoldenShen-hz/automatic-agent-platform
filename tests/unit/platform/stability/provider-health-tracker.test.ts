import assert from "node:assert/strict";
import test from "node:test";

import {
  ProviderHealthTracker,
  type ProviderAttemptRecord,
  type ProviderHealthSummary,
} from "../../../../src/platform/shared/observability/provider-health-tracker.js";

test("ProviderHealthTracker exports are available", () => {
  assert.equal(typeof ProviderHealthTracker, "function");
});

test("ProviderHealthTracker can be instantiated", () => {
  const tracker = new ProviderHealthTracker();
  assert.ok(tracker instanceof ProviderHealthTracker);
});

test("ProviderHealthTracker records attempt successfully", () => {
  const tracker = new ProviderHealthTracker();
  const record: ProviderAttemptRecord = {
    provider: "openai",
    model: "gpt-4",
    succeeded: true,
    latencyMs: 150,
    recordedAt: new Date().toISOString(),
  };

  const result = tracker.recordAttempt(record);

  assert.equal(result.provider, "openai");
  assert.equal(result.model, "gpt-4");
  assert.equal(result.succeeded, true);
});

test("ProviderHealthTracker records failed attempt", () => {
  const tracker = new ProviderHealthTracker();
  const record: ProviderAttemptRecord = {
    provider: "anthropic",
    model: "claude-3",
    succeeded: false,
    latencyMs: 200,
    recordedAt: new Date().toISOString(),
    errorCode: "rate_limit",
  };

  const result = tracker.recordAttempt(record);

  assert.equal(result.succeeded, false);
  assert.equal(result.errorCode, "rate_limit");
});

test("ProviderHealthTracker getSummary returns healthy status for no data", () => {
  const tracker = new ProviderHealthTracker();

  const summary = tracker.getSummary();

  assert.equal(summary.status, "healthy");
  assert.equal(summary.successRate, 1);
  assert.equal(summary.totalCalls, 0);
  assert.equal(summary.failedCalls, 0);
  assert.deepEqual(summary.latestFailureCodes, []);
});

test("ProviderHealthTracker getSummary calculates success rate", () => {
  const tracker = new ProviderHealthTracker();
  const now = new Date().toISOString();

  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  assert.equal(summary.totalCalls, 3);
  assert.equal(summary.successfulCalls, 2);
  assert.equal(summary.failedCalls, 1);
  assert.ok(Math.abs(summary.successRate - 0.667) < 0.01);
});

test("ProviderHealthTracker getSummary status is healthy when successRate >= degradedThreshold", () => {
  const tracker = new ProviderHealthTracker({ degradedThreshold: 0.8 });
  const now = new Date().toISOString();

  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  assert.equal(summary.status, "healthy");
});

test("ProviderHealthTracker getSummary status is degraded when successRate < degradedThreshold", () => {
  const tracker = new ProviderHealthTracker({ degradedThreshold: 0.8 });
  const now = new Date().toISOString();

  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  assert.equal(summary.status, "degraded");
});

test("ProviderHealthTracker getSummary status is failed when successRate < failedThreshold", () => {
  const tracker = new ProviderHealthTracker({ degradedThreshold: 0.8, failedThreshold: 0.5 });
  const now = new Date().toISOString();

  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  assert.equal(summary.status, "failed");
});

test("ProviderHealthTracker getSummary respects windowMs", () => {
  const tracker = new ProviderHealthTracker();
  const now = new Date();
  const nowIso = now.toISOString();

  // Old attempt (outside window)
  const oldTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: oldTime });

  // Recent attempt (inside window)
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: nowIso });

  // 5 minute window from now should only include the recent attempt
  const summary = tracker.getSummary(5 * 60 * 1000, nowIso);

  assert.equal(summary.totalCalls, 1);
  assert.equal(summary.successfulCalls, 1);
});

test("ProviderHealthTracker getSummary tracks fallbackCount", () => {
  const tracker = new ProviderHealthTracker();
  const now = new Date().toISOString();

  tracker.recordAttempt({
    provider: "openai",
    model: "gpt-4",
    succeeded: false,
    latencyMs: 100,
    recordedAt: now,
    fallbackProvider: "anthropic",
  });
  tracker.recordAttempt({
    provider: "openai",
    model: "gpt-4",
    succeeded: true,
    latencyMs: 100,
    recordedAt: now,
  });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  assert.equal(summary.fallbackCount, 1);
});

test("ProviderHealthTracker getSummary collects latestFailureCodes", () => {
  const tracker = new ProviderHealthTracker();
  const now = new Date().toISOString();

  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now, errorCode: "error_1" });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now, errorCode: "error_2" });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now, errorCode: "error_3" });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now, errorCode: "error_4" });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now, errorCode: "error_5" });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now, errorCode: "error_6" });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  // Should only have last 5 failure codes
  assert.equal(summary.latestFailureCodes.length, 5);
  assert.deepEqual(summary.latestFailureCodes, ["error_1", "error_2", "error_3", "error_4", "error_5"]);
});

test("ProviderHealthTracker respects retentionLimit", () => {
  const tracker = new ProviderHealthTracker({ retentionLimit: 3 });
  const now = new Date().toISOString();

  for (let i = 0; i < 5; i++) {
    tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  }

  const summary = tracker.getSummary(10 * 60 * 1000, now);

  assert.equal(summary.totalCalls, 3);
});

test("ProviderHealthTracker uses default values", () => {
  const tracker = new ProviderHealthTracker({});

  assert.ok(tracker instanceof ProviderHealthTracker);
});

test("ProviderHealthTracker custom thresholds", () => {
  const tracker = new ProviderHealthTracker({
    degradedThreshold: 0.9,
    failedThreshold: 0.3,
    retentionLimit: 100,
  });

  const now = new Date().toISOString();

  // 1 success, 1 failure = 50% success rate
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: true, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  // 50% < 90% degraded, but 50% >= 30% failed threshold
  assert.equal(summary.status, "degraded");
});

test("ProviderHealthTracker records with all fields", () => {
  const tracker = new ProviderHealthTracker();
  const record: ProviderAttemptRecord = {
    provider: "anthropic",
    model: "claude-3-opus",
    succeeded: false,
    latencyMs: 300,
    recordedAt: new Date().toISOString(),
    errorCode: "context_length_exceeded",
    fallbackProvider: "openai",
  };

  const result = tracker.recordAttempt(record);

  assert.equal(result.provider, "anthropic");
  assert.equal(result.model, "claude-3-opus");
  assert.equal(result.succeeded, false);
  assert.equal(result.latencyMs, 300);
  assert.equal(result.errorCode, "context_length_exceeded");
  assert.equal(result.fallbackProvider, "openai");
});

test("ProviderHealthTracker getSummary with only failed attempts", () => {
  const tracker = new ProviderHealthTracker();
  const now = new Date().toISOString();

  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: now });

  const summary = tracker.getSummary(5 * 60 * 1000, now);

  assert.equal(summary.status, "failed");
  assert.equal(summary.successRate, 0);
  assert.equal(summary.totalCalls, 2);
  assert.equal(summary.failedCalls, 2);
  assert.equal(summary.successfulCalls, 0);
});

test("ProviderHealthTracker getSummary empty array when all attempts outside window", () => {
  const tracker = new ProviderHealthTracker();
  const now = new Date();
  const nowIso = now.toISOString();

  // All attempts are old (outside 5 minute window)
  const oldTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: oldTime });
  tracker.recordAttempt({ provider: "openai", model: "gpt-4", succeeded: false, latencyMs: 100, recordedAt: oldTime });

  const summary = tracker.getSummary(5 * 60 * 1000, nowIso);

  assert.equal(summary.status, "healthy");
  assert.equal(summary.totalCalls, 0);
});

test("ProviderHealthSummary interface structure", () => {
  const summary: ProviderHealthSummary = {
    status: "healthy",
    successRate: 1,
    totalCalls: 0,
    failedCalls: 0,
    fallbackCount: 0,
    latestFailureCodes: [],
  };

  assert.equal(summary.status, "healthy");
  assert.equal(summary.successRate, 1);
});

test("ProviderAttemptRecord interface structure", () => {
  const record: ProviderAttemptRecord = {
    provider: "test",
    model: "test-model",
    succeeded: true,
    latencyMs: 100,
    recordedAt: new Date().toISOString(),
  };

  assert.ok(record.provider != null);
  assert.ok(record.model != null);
  assert.ok(typeof record.succeeded === "boolean");
  assert.ok(typeof record.latencyMs === "number");
  assert.ok(typeof record.recordedAt === "string");
});