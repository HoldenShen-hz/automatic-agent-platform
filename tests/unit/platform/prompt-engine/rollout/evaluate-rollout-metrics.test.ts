/**
 * evaluateRolloutMetrics Unit Tests
 *
 * Tests for PromptRolloutService.evaluateRolloutMetrics covering:
 * - Quality regression detection (5% drop)
 * - Latency regression detection (20% increase)
 * - Error rate threshold enforcement per stage
 * - Rollback only from active stages (canary_5, canary_20, stable)
 * - No rollback from blocked/deprecated/rolled_back states
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

function createRolloutAndEvaluate(
  rollout: PromptRolloutService,
  templateKey: string,
  mode: "suggest",
): { rolloutId: string; status: string } {
  const registry = new PromptTemplateRegistryService();
  const template = registry.registerTemplate({
    templateKey,
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode,
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  return { rolloutId: record.rolloutId, status: record.status };
}

test("evaluateRolloutMetrics does not rollback from blocked status", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "blocked_metrics_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: false, // Causes blocked status
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "blocked");

  const result = rollout.evaluateRolloutMetrics(record.rolloutId, {
    qualityScore: 0.5,
    latencyP99Ms: 200,
    errorRate: 0.1,
    previousQualityScore: 0.8,
    previousLatencyP99Ms: 100,
  });

  // Blocked status should not trigger rollback
  assert.equal(result.status, "blocked");
});

test("evaluateRolloutMetrics does not rollback from non-active status", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "non_active_metrics_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: false, // Will be blocked
    domainBlockCompatible: true,
  });

  // blocked status - evaluateRolloutMetrics should return same status
  const result = rollout.evaluateRolloutMetrics(record.rolloutId, {
    qualityScore: 0.3,
    latencyP99Ms: 500,
    errorRate: 0.15,
    previousQualityScore: 0.9,
    previousLatencyP99Ms: 100,
  });

  assert.equal(result.status, "blocked");
});

test("evaluateRolloutMetrics triggers rollback on quality regression for canary_5", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "quality_regression_canary5", "suggest");

  // Only test if we're in an active stage that can rollback
  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.7,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.8, // 10% drop, exceeds 5% threshold
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("quality_regression"));
});

test("evaluateRolloutMetrics triggers rollback on quality regression", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "quality_regression_generic", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.6,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.75, // Exceeds 5% threshold
  });

  assert.equal(result.status, "rolled_back");
});

test("evaluateRolloutMetrics triggers rollback on latency regression", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "latency_regression_generic", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 241, // Just over 20% above previous (241 > 240)
    errorRate: 0.005,
    previousLatencyP99Ms: 200,
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("latency_regression"));
});

test("evaluateRolloutMetrics triggers rollback on error rate exceeding canary_5 threshold", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "error_rate_canary5", "suggest");

  if (status !== "canary_5") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 100,
    errorRate: 0.06, // Exceeds 5% threshold for canary_5
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("error_rate_exceeded"));
});

test("evaluateRolloutMetrics triggers rollback when error rate exceeds stage threshold", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "error_rate_generic", "suggest");

  // Error rate 0.04 exceeds canary_20 threshold (3%) but not canary_5 (5%)
  if (status === "canary_20") {
    const result = rollout.evaluateRolloutMetrics(rolloutId, {
      qualityScore: 0.85,
      latencyP99Ms: 100,
      errorRate: 0.04,
    });
    assert.equal(result.status, "rolled_back");
  } else if (status === "stable") {
    // 4% exceeds stable 1% threshold
    const result = rollout.evaluateRolloutMetrics(rolloutId, {
      qualityScore: 0.85,
      latencyP99Ms: 100,
      errorRate: 0.04,
    });
    assert.equal(result.status, "rolled_back");
  }
});

test("evaluateRolloutMetrics does not rollback when all metrics are healthy", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "healthy_metrics", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 100,
    errorRate: 0.005,
    previousQualityScore: 0.82, // Small drop, within threshold
    previousLatencyP99Ms: 110, // Small increase, within threshold
  });

  assert.equal(result.status, status);
});

test("evaluateRolloutMetrics handles missing previous metrics", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "no_previous_metrics", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // No previous metrics - only error rate can trigger rollback
  // For canary_5, 2% is below 5% threshold
  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.9,
    latencyP99Ms: 100,
    errorRate: 0.02,
  });

  // Error rate should not trigger rollback at canary_5 with 2%
  assert.equal(result.status, status);
});

test("evaluateRolloutMetrics throws when rollout not found", () => {
  const rollout = new PromptRolloutService();

  assert.throws(
    () =>
      rollout.evaluateRolloutMetrics("nonexistent-rollout-id", {
        qualityScore: 0.5,
        latencyP99Ms: 200,
        errorRate: 0.1,
      }),
    (err: unknown) => err instanceof ValidationError && err.code.includes("not_found"),
  );
});

test("evaluateRolloutMetrics rollback reason includes quality values", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "quality_values_in_reason", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.7,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.85,
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("0.85"));
  assert.ok(result.guardrailSummary.includes("0.70"));
});

test("evaluateRolloutMetrics rollback reason includes latency values", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "latency_values_in_reason", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 241,
    errorRate: 0.01,
    previousLatencyP99Ms: 200,
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("200ms"));
  assert.ok(result.guardrailSummary.includes("241ms"));
});

test("evaluateRolloutMetrics rollback reason includes error rate and threshold", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "error_rate_in_reason", "suggest");

  if (status !== "canary_5") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 100,
    errorRate: 0.06,
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("error_rate_exceeded"));
  assert.ok(result.guardrailSummary.includes("0.060"));
  assert.ok(result.guardrailSummary.includes("0.05")); // canary_5 threshold
});

test("evaluateRolloutMetrics quality regression is 5% threshold", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "quality_threshold_test", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Exactly 5% drop - should NOT trigger rollback (must be MORE than 5%)
  const resultAtThreshold = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.80,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.85,
  });

  // At exactly 5% drop, no rollback should occur
  assert.equal(resultAtThreshold.status, status);

  // Just over 5% drop - SHOULD trigger rollback
  const resultOverThreshold = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.79,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.85,
  });

  assert.equal(resultOverThreshold.status, "rolled_back");
});

test("evaluateRolloutMetrics latency regression is 20% increase", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "latency_threshold_test", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Exactly 20% increase - should NOT trigger rollback (must be MORE than 20%)
  const resultAtThreshold = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 120,
    errorRate: 0.01,
    previousLatencyP99Ms: 100,
  });

  // At exactly 20%, no rollback
  assert.equal(resultAtThreshold.status, status);

  // Just over 20% increase - SHOULD trigger rollback
  const resultOverThreshold = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 121,
    errorRate: 0.01,
    previousLatencyP99Ms: 100,
  });

  assert.equal(resultOverThreshold.status, "rolled_back");
});

test("evaluateRolloutMetrics quality takes precedence over latency when both regress", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "dual_regression_test", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.7,
    latencyP99Ms: 250,
    errorRate: 0.01,
    previousQualityScore: 0.85,
    previousLatencyP99Ms: 100,
  });

  // Both regressions present - rollback should occur
  assert.equal(result.status, "rolled_back");
  // Reason should mention quality_regression (checked first)
  assert.ok(result.guardrailSummary.includes("quality_regression"));
});

test("evaluateRolloutMetrics does not rollback rolled_back status", () => {
  const registry = new PromptTemplateRegistryService();
  const rollout = new PromptRolloutService();
  const template = registry.registerTemplate({
    templateKey: "already_rolled_back",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "suggest",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  if (record.status === "blocked") {
    return;
  }

  // First rollback
  const firstRollback = rollout.rollbackRollout(record.rolloutId, "initial_cause");
  assert.equal(firstRollback.status, "rolled_back");

  // Try to evaluate metrics on already rolled back
  const result = rollout.evaluateRolloutMetrics(record.rolloutId, {
    qualityScore: 0.5,
    latencyP99Ms: 500,
    errorRate: 0.5,
  });

  // Should return the already rolled_back record, not trigger another rollback
  assert.equal(result.status, "rolled_back");
});

test("evaluateRolloutMetrics respects error rate stage thresholds", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "error_stage_threshold", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Error rate that would pass canary_5 but fail canary_20
  // 4% is below 5% (canary_5) but above 3% (canary_20) and 1% (stable)
  const errorRate = 0.04;
  const threshold = status === "canary_5" ? 0.05 : status === "canary_20" ? 0.03 : 0.01;

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 100,
    errorRate,
  });

  if (errorRate > threshold) {
    assert.equal(result.status, "rolled_back", `With error rate ${errorRate} and threshold ${threshold}, expected rollback`);
  } else {
    assert.equal(result.status, status);
  }
});

test("evaluateRolloutMetrics no regression when quality just under threshold", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "quality_just_under", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Previous 0.85, current 0.80 - that's exactly 5% drop, which should NOT trigger
  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.80,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.85,
  });

  assert.equal(result.status, status);
});

test("evaluateRolloutMetrics no regression when latency just under threshold", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "latency_just_under", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Previous 100ms, current 120ms - that's exactly 20% increase, which should NOT trigger
  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 120,
    errorRate: 0.01,
    previousLatencyP99Ms: 100,
  });

  assert.equal(result.status, status);
});

test("evaluateRolloutMetrics with all three regression types", () => {
  const rollout = new PromptRolloutService();
  const { rolloutId, status } = createRolloutAndEvaluate(rollout, "triple_regression", "suggest");

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.5,
    latencyP99Ms: 300,
    errorRate: 0.1,
    previousQualityScore: 0.85,
    previousLatencyP99Ms: 100,
  });

  assert.equal(result.status, "rolled_back");
});

test("evaluateRolloutMetrics returns original record when not rollbackable", () => {
  const rollout = new PromptRolloutService();

  // Try to evaluate a blocked rollout
  const registry = new PromptTemplateRegistryService();
  const template = registry.registerTemplate({
    templateKey: "blocked_returns_original",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rollout.createRollout({
    template,
    mode: "off",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: false, // blocked
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "blocked");

  const result = rollout.evaluateRolloutMetrics(record.rolloutId, {
    qualityScore: 0.9,
    latencyP99Ms: 50,
    errorRate: 0.001,
  });

  // Should return the blocked record unchanged
  assert.equal(result.status, "blocked");
  assert.equal(result.rolloutId, record.rolloutId);
});