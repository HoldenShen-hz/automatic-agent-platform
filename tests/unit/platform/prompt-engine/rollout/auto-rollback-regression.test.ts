/**
 * R23-46 / Issue 1958 Unit Tests: Automatic Rollback on Metric Regression
 *
 * Tests verifying that PromptRolloutService.evaluateRolloutMetrics automatically
 * triggers rollback when metric regression is detected AND autoRollbackConfig is set.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PromptRolloutService,
  PromptRolloutAutoRollbackConfig,
} from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";

function createActiveRollout(
  rolloutService: PromptRolloutService,
  templateRegistry: PromptTemplateRegistryService,
  templateKey = "auto_rollback_test",
): { rolloutId: string; status: string } {
  const template = templateRegistry.registerTemplate({
    templateKey,
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  const record = rolloutService.createRollout({
    template,
    mode: "L3_canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: true,
    domainBlockCompatible: true,
  });

  // Activate through canary stages to reach an active state
  let rolloutId = record.rolloutId;
  let status = record.status;

  if (status === "canary_5") {
    const activated = rolloutService.activateRollout(rolloutId);
    status = activated.status;
    rolloutId = activated.rolloutId;
  }
  if (status === "canary_20") {
    const activated = rolloutService.activateRollout(rolloutId);
    status = activated.status;
    rolloutId = activated.rolloutId;
  }

  return { rolloutId, status };
}

test("PromptRolloutService auto-rollback triggers rollback on quality regression when configured", () => {
  const registry = new PromptTemplateRegistryService();
  const autoRollbackConfig: PromptRolloutAutoRollbackConfig = {
    maxQualityDrop: 0.05,
    maxLatencyMultiplier: 1.2,
    minimumSampleCount: 10,
  };
  const rollout = new PromptRolloutService(autoRollbackConfig);
  const { rolloutId, status } = createActiveRollout(rollout, registry);

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.7,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.8,
    previousLatencyP99Ms: null,
    sampleCount: 20,
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("auto_rollback"));
  assert.ok(result.guardrailSummary.includes("quality_regression"));
});

test("PromptRolloutService auto-rollback triggers rollback on latency regression when configured", () => {
  const registry = new PromptTemplateRegistryService();
  const autoRollbackConfig: PromptRolloutAutoRollbackConfig = {
    maxQualityDrop: 0.05,
    maxLatencyMultiplier: 1.2,
    minimumSampleCount: 10,
  };
  const rollout = new PromptRolloutService(autoRollbackConfig);
  const { rolloutId, status } = createActiveRollout(rollout, registry);

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 250,
    errorRate: 0.01,
    previousQualityScore: null,
    previousLatencyP99Ms: 200,
    sampleCount: 20,
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("auto_rollback"));
  assert.ok(result.guardrailSummary.includes("latency_regression"));
});

test("PromptRolloutService auto-rollback triggers rollback on error rate regression when configured", () => {
  const registry = new PromptTemplateRegistryService();
  const autoRollbackConfig: PromptRolloutAutoRollbackConfig = {
    maxQualityDrop: 0.05,
    maxLatencyMultiplier: 1.2,
    minimumSampleCount: 10,
  };
  const rollout = new PromptRolloutService(autoRollbackConfig);
  const { rolloutId, status } = createActiveRollout(rollout, registry);

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const threshold = status === "canary_5" ? 0.06 : status === "canary_20" ? 0.04 : 0.02;
  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.85,
    latencyP99Ms: 100,
    errorRate: threshold + 0.01,
    previousQualityScore: null,
    previousLatencyP99Ms: null,
    sampleCount: 20,
  });

  assert.equal(result.status, "rolled_back");
  assert.ok(result.guardrailSummary.includes("auto_rollback"));
  assert.ok(result.guardrailSummary.includes("error_rate_exceeded"));
});

test("PromptRolloutService auto-rollback does NOT rollback when sampleCount below minimum", () => {
  const registry = new PromptTemplateRegistryService();
  const autoRollbackConfig: PromptRolloutAutoRollbackConfig = {
    maxQualityDrop: 0.05,
    maxLatencyMultiplier: 1.2,
    minimumSampleCount: 100,
  };
  const rollout = new PromptRolloutService(autoRollbackConfig);
  const { rolloutId, status } = createActiveRollout(rollout, registry);

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Regression present but sampleCount is only 5 (< minimumSampleCount of 100)
  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.5,
    latencyP99Ms: 500,
    errorRate: 0.5,
    previousQualityScore: 0.9,
    previousLatencyP99Ms: 100,
    sampleCount: 5,
  });

  // Should NOT rollback due to insufficient sample count
  assert.equal(result.status, status);
});

test("PromptRolloutService without autoRollbackConfig still evaluates metrics (backward compatible)", () => {
  const registry = new PromptTemplateRegistryService();
  // No autoRollbackConfig - uses default behavior
  const rollout = new PromptRolloutService(null);
  const { rolloutId, status } = createActiveRollout(rollout, registry);

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Regression present - should still rollback via default evaluation
  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.7,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.8,
    previousLatencyP99Ms: null,
  });

  assert.equal(result.status, "rolled_back");
  // Default evaluation does not prefix with "auto_rollback:"
  assert.ok(result.guardrailSummary.includes("quality_regression"));
  assert.ok(!result.guardrailSummary.startsWith("auto_rollback:"));
});

test("PromptRolloutService auto-rollback uses configured thresholds", () => {
  const registry = new PromptTemplateRegistryService();
  // Custom threshold: only trigger if quality drops more than 0.10 (10 points)
  const autoRollbackConfig: PromptRolloutAutoRollbackConfig = {
    maxQualityDrop: 0.10,
    maxLatencyMultiplier: 1.5,
    minimumSampleCount: 5,
  };
  const rollout = new PromptRolloutService(autoRollbackConfig);
  const { rolloutId, status } = createActiveRollout(rollout, registry);

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  // Only 5% drop - below the 10% threshold, so should NOT rollback
  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.80,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.85,
    previousLatencyP99Ms: null,
    sampleCount: 10,
  });

  // Within configured threshold, no rollback
  assert.equal(result.status, status);

  // Now trigger a regression that exceeds the custom threshold (>10% drop)
  const resultOverThreshold = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.70,
    latencyP99Ms: 100,
    errorRate: 0.01,
    previousQualityScore: 0.85,
    previousLatencyP99Ms: null,
    sampleCount: 10,
  });

  assert.equal(resultOverThreshold.status, "rolled_back");
  assert.ok(resultOverThreshold.guardrailSummary.includes("auto_rollback"));
});

test("PromptRolloutService auto-rollback reason includes metric values", () => {
  const registry = new PromptTemplateRegistryService();
  const autoRollbackConfig: PromptRolloutAutoRollbackConfig = {
    maxQualityDrop: 0.05,
    maxLatencyMultiplier: 1.2,
    minimumSampleCount: 10,
  };
  const rollout = new PromptRolloutService(autoRollbackConfig);
  const { rolloutId, status } = createActiveRollout(rollout, registry);

  if (status !== "canary_5" && status !== "canary_20" && status !== "stable") {
    return;
  }

  const result = rollout.evaluateRolloutMetrics(rolloutId, {
    qualityScore: 0.7,
    latencyP99Ms: 250,
    errorRate: 0.01,
    previousQualityScore: 0.85,
    previousLatencyP99Ms: 200,
    sampleCount: 20,
  });

  assert.equal(result.status, "rolled_back");
  // Reason should contain the actual values
  assert.ok(result.guardrailSummary.includes("0.85"));
  assert.ok(result.guardrailSummary.includes("0.70"));
});

test("PromptRolloutService auto-rollback does not trigger from non-active status", () => {
  const registry = new PromptTemplateRegistryService();
  const autoRollbackConfig: PromptRolloutAutoRollbackConfig = {
    maxQualityDrop: 0.05,
    maxLatencyMultiplier: 1.2,
    minimumSampleCount: 10,
  };
  const rollout = new PromptRolloutService(autoRollbackConfig);

  const template = registry.registerTemplate({
    templateKey: "blocked_auto_rollback_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Test prefix",
    domainBlock: "Test domain",
  });

  // Create a blocked rollout
  const record = rollout.createRollout({
    template,
    mode: "L3_canary",
    owner: "test@example.com",
    regressionSuiteId: "suite_1",
    regressionPassed: false,
    domainBlockCompatible: true,
  });

  assert.equal(record.status, "blocked");

  // Even with regression and sufficient samples, blocked should not trigger rollback
  const result = rollout.evaluateRolloutMetrics(record.rolloutId, {
    qualityScore: 0.5,
    latencyP99Ms: 500,
    errorRate: 0.5,
    previousQualityScore: 0.9,
    previousLatencyP99Ms: 100,
    sampleCount: 100,
  });

  assert.equal(result.status, "blocked");
});
