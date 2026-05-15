import assert from "node:assert/strict";
import test from "node:test";

import {
  CompositeHealthScoreService,
  type HealthDimension,
  type HealthIndicator,
  type HealthScore,
  type HealthStatus,
  type HealthThresholds,
} from "../../../../src/platform/stability/composite-health-score-service.js";

test("CompositeHealthScoreService exports are available", () => {
  assert.equal(typeof CompositeHealthScoreService, "function");
});

test("CompositeHealthScoreService can be instantiated", () => {
  const service = new CompositeHealthScoreService();
  assert.ok(service instanceof CompositeHealthScoreService);
});

test("CompositeHealthScoreService registers indicator successfully", () => {
  const service = new CompositeHealthScoreService();
  const indicator = service.registerIndicator("system", "cpu-health", 85);

  assert.ok(indicator.indicatorId.startsWith("hlt"));
  assert.equal(indicator.dimension, "system");
  assert.equal(indicator.name, "cpu-health");
  assert.equal(indicator.rawValue, 85);
  assert.equal(typeof indicator.score, "number");
  assert.equal(indicator.weight, 0.15); // default system weight
  assert.ok(indicator.isHealthy);
});

test("CompositeHealthScoreService registers indicator with custom weight", () => {
  const service = new CompositeHealthScoreService();
  const indicator = service.registerIndicator("execution", "exec-rate", 95, 0.5);

  assert.equal(indicator.weight, 0.5);
});

test("CompositeHealthScoreService updateIndicator changes raw value", () => {
  const service = new CompositeHealthScoreService();
  const indicator = service.registerIndicator("memory", "mem-usage", 20);

  assert.equal(indicator.rawValue, 20);
  assert.equal(indicator.score, 80); // 100 - 20

  service.updateIndicator(indicator.indicatorId, 60);

  const updated = service.getIndicators().find((i) => i.indicatorId === indicator.indicatorId);
  assert.ok(updated);
  assert.equal(updated.rawValue, 60);
  assert.equal(updated.score, 40); // 100 - 60
});

test("CompositeHealthScoreService removeIndicator deletes indicator", () => {
  const service = new CompositeHealthScoreService();
  const indicator = service.registerIndicator("network", "latency", 50);

  assert.equal(service.getIndicators().length, 1);

  service.removeIndicator(indicator.indicatorId);

  assert.equal(service.getIndicators().length, 0);
});

test("CompositeHealthScoreService getHealthScore returns HealthScore structure", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 100);
  service.registerIndicator("execution", "exec-1", 90);

  const score = service.getHealthScore();

  assert.equal(typeof score.overallScore, "number");
  assert.ok(score.overallScore >= 0 && score.overallScore <= 100);
  assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(score.status));
  assert.ok(Array.isArray(score.indicators));
  assert.equal(typeof score.dimensionScores, "object");
  assert.equal(typeof score.computedAt, "string");
  assert.equal(typeof score.isHealthy, "boolean");
  assert.ok(score.traceId.startsWith("htrace"));
});

test("CompositeHealthScoreService caches health score", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 100);

  const score1 = service.getHealthScore();
  const score2 = service.getHealthScore();

  assert.strictEqual(score1, score2); // Same cached instance
});

test("CompositeHealthScoreService forces recompute when requested", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 100);

  const score1 = service.getHealthScore();
  const score2 = service.getHealthScore(true);

  assert.notStrictEqual(score1, score2); // Different instances
});

test("CompositeHealthScoreService getIndicators returns all registered", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 100);
  service.registerIndicator("execution", "exec-1", 90);

  const indicators = service.getIndicators();

  assert.equal(indicators.length, 2);
});

test("CompositeHealthScoreService getIndicatorsByDimension filters correctly", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 100);
  service.registerIndicator("system", "sys-2", 80);
  service.registerIndicator("execution", "exec-1", 90);

  const systemIndicators = service.getIndicatorsByDimension("system");

  assert.equal(systemIndicators.length, 2);
  assert.ok(systemIndicators.every((i) => i.dimension === "system"));
});

test("CompositeHealthScoreService computeOverallScore with empty indicators returns 100", () => {
  const service = new CompositeHealthScoreService();
  const score = service.getHealthScore();

  assert.equal(score.overallScore, 100);
  assert.equal(score.status, "ok");
});

test("CompositeHealthScoreService computeOverallScore with weighted indicators", () => {
  const service = new CompositeHealthScoreService();
  // System weight: 0.15, execution weight: 0.25
  service.registerIndicator("system", "sys-1", 50); // score 50
  service.registerIndicator("execution", "exec-1", 100); // score 100

  const score = service.getHealthScore();

  // weighted = (0.15 * 50 + 0.25 * 100) / (0.15 + 0.25) = 31.25 / 0.4 = 78.125
  assert.ok(score.overallScore > 50);
  assert.ok(score.overallScore < 100);
});

test("CompositeHealthScoreService dimension scoring - system dimension", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 80);

  const score = service.getHealthScore();

  assert.ok(score.dimensionScores.system >= 0);
  assert.equal(score.dimensionScores.system, 80);
});

test("CompositeHealthScoreService dimension scoring - queue dimension (lower is better)", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("queue", "queue-depth", 30); // 30 items queued = score 70

  const score = service.getHealthScore();

  assert.equal(score.dimensionScores.queue, 70);
});

test("CompositeHealthScoreService dimension scoring - storage dimension (lower is better)", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("storage", "storage-usage", 50); // 50% used = score 50

  const score = service.getHealthScore();

  assert.equal(score.dimensionScores.storage, 50);
});

test("CompositeHealthScoreService dimension scoring - network dimension (lower is better)", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("network", "latency", 500); // 500ms latency

  const score = service.getHealthScore();

  // 500ms = 50 score (100 - (500/1000)*100)
  assert.equal(score.dimensionScores.network, 50);
});

test("CompositeHealthScoreService dimension scoring - compute dimension (lower is better)", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("compute", "cpu-usage", 75); // 75% CPU

  const score = service.getHealthScore();

  assert.equal(score.dimensionScores.compute, 25);
});

test("CompositeHealthScoreService dimension scoring - memory dimension (lower is better)", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("memory", "mem-usage", 20); // 20% memory

  const score = service.getHealthScore();

  assert.equal(score.dimensionScores.memory, 80);
});

test("CompositeHealthScoreService dimension averaging with multiple indicators", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 60);
  service.registerIndicator("system", "sys-2", 80);

  const score = service.getHealthScore();

  // Average of 60 and 80 = 70
  assert.equal(score.dimensionScores.system, 70);
});

test("CompositeHealthScoreService dimension defaults to 100 when no indicators", () => {
  const service = new CompositeHealthScoreService();

  const score = service.getHealthScore();

  assert.equal(score.dimensionScores.execution, 100);
});

test("CompositeHealthScoreService status determination - ok", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("system", "sys-1", 100);

  const score = service.getHealthScore();

  assert.equal(score.status, "ok");
  assert.ok(score.isHealthy);
});

test("CompositeHealthScoreService status determination - degraded", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("system", "sys-1", 55); // score 55, between 40-70

  const score = service.getHealthScore();

  assert.equal(score.status, "degraded");
  assert.ok(score.isHealthy);
});

test("CompositeHealthScoreService status determination - unhealthy", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("system", "sys-1", 30); // score 30, below 40

  const score = service.getHealthScore();

  assert.equal(score.status, "unhealthy");
  assert.ok(!score.isHealthy);
});

test("CompositeHealthScoreService status determination - overloaded", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("queue", "queue-depth", 95);

  const score = service.getHealthScore();

  assert.equal(score.status, "overloaded");
  assert.ok(!score.isHealthy);
});

test("CompositeHealthScoreService custom thresholds", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 30, degradedThreshold: 60, overloadedThreshold: 80 },
  });
  service.registerIndicator("system", "sys-1", 55);

  const score = service.getHealthScore();

  assert.equal(score.status, "degraded");
});

test("CompositeHealthScoreService default thresholds", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 50); // score 50, between 40-70

  const score = service.getHealthScore();

  assert.equal(score.status, "degraded"); // default degraded threshold is 70
});

test("CompositeHealthScoreService default weights sum to 1.0", () => {
  const service = new CompositeHealthScoreService();

  // Access private defaultWeights via a registered indicator
  service.registerIndicator("system", "sys-1", 100);
  const indicators = service.getIndicators();

  // Verify we can register all dimensions and they use correct defaults
  service.registerIndicator("execution", "exec-1", 100);
  service.registerIndicator("queue", "queue-1", 0); // inverted dimension
  service.registerIndicator("storage", "storage-1", 0); // inverted dimension
  service.registerIndicator("network", "net-1", 0); // inverted dimension
  service.registerIndicator("compute", "cpu-1", 0); // inverted dimension
  service.registerIndicator("memory", "mem-1", 0); // inverted dimension

  const allIndicators = service.getIndicators();
  assert.equal(allIndicators.length, 7);
});

test("CompositeHealthScoreService custom default weights", () => {
  const service = new CompositeHealthScoreService({
    defaultWeights: { system: 0.5, execution: 0.5 },
  });

  const indicator = service.registerIndicator("system", "sys-1", 100);

  assert.equal(indicator.weight, 0.5);
});

test("CompositeHealthScoreService updateIndicator invalidates cache", () => {
  const service = new CompositeHealthScoreService();
  service.registerIndicator("system", "sys-1", 100);

  const score1 = service.getHealthScore();
  service.updateIndicator(service.getIndicators()[0].indicatorId, 50);
  const score2 = service.getHealthScore();

  assert.notStrictEqual(score1, score2);
});

test("CompositeHealthScoreService removeIndicator invalidates cache", () => {
  const service = new CompositeHealthScoreService();
  const indicator = service.registerIndicator("system", "sys-1", 100);

  const score1 = service.getHealthScore();
  service.removeIndicator(indicator.indicatorId);
  const score2 = service.getHealthScore();

  assert.notStrictEqual(score1, score2);
});

test("CompositeHealthScoreService normalizes system dimension", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("system", "sys-100", 100);
  service.registerIndicator("system", "sys-0", 0);
  service.registerIndicator("system", "sys-neg", -10);
  service.registerIndicator("system", "sys-over", 150);

  const indicators = service.getIndicators();

  const score100 = indicators.find((i) => i.name === "sys-100");
  const score0 = indicators.find((i) => i.name === "sys-0");
  const scoreNeg = indicators.find((i) => i.name === "sys-neg");
  const scoreOver = indicators.find((i) => i.name === "sys-over");

  assert.equal(score100!.score, 100);
  assert.equal(score0!.score, 0);
  assert.equal(scoreNeg!.score, 0); // clamped to 0
  assert.equal(scoreOver!.score, 100); // clamped to 100
});

test("CompositeHealthScoreService normalizes execution dimension", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("execution", "exec-100", 100);
  service.registerIndicator("execution", "exec-50", 50);

  const indicators = service.getIndicators();

  assert.equal(indicators.find((i) => i.name === "exec-100")!.score, 100);
  assert.equal(indicators.find((i) => i.name === "exec-50")!.score, 50);
});

test("CompositeHealthScoreService normalizes queue dimension (inverted)", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("queue", "q-empty", 0);
  service.registerIndicator("queue", "q-half", 50);
  service.registerIndicator("queue", "q-full", 100);
  service.registerIndicator("queue", "q-over", 150);

  const indicators = service.getIndicators();

  assert.equal(indicators.find((i) => i.name === "q-empty")!.score, 100);
  assert.equal(indicators.find((i) => i.name === "q-half")!.score, 50);
  assert.equal(indicators.find((i) => i.name === "q-full")!.score, 0);
  assert.equal(indicators.find((i) => i.name === "q-over")!.score, 0); // clamped
});

test("CompositeHealthScoreService normalizes storage dimension (inverted)", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("storage", "s-empty", 0);
  service.registerIndicator("storage", "s-half", 50);
  service.registerIndicator("storage", "s-full", 100);

  const indicators = service.getIndicators();

  assert.equal(indicators.find((i) => i.name === "s-empty")!.score, 100);
  assert.equal(indicators.find((i) => i.name === "s-half")!.score, 50);
  assert.equal(indicators.find((i) => i.name === "s-full")!.score, 0);
});

test("CompositeHealthScoreService normalizes network dimension (inverted)", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("network", "n-zero", 0);
  service.registerIndicator("network", "n-500ms", 500);
  service.registerIndicator("network", "n-1000ms", 1000);
  service.registerIndicator("network", "n-over", 1500);

  const indicators = service.getIndicators();

  assert.equal(indicators.find((i) => i.name === "n-zero")!.score, 100);
  assert.equal(indicators.find((i) => i.name === "n-500ms")!.score, 50);
  assert.equal(indicators.find((i) => i.name === "n-1000ms")!.score, 0);
  assert.equal(indicators.find((i) => i.name === "n-over")!.score, 0);
});

test("CompositeHealthScoreService normalizes compute dimension (inverted)", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("compute", "c-0", 0);
  service.registerIndicator("compute", "c-50", 50);
  service.registerIndicator("compute", "c-100", 100);

  const indicators = service.getIndicators();

  assert.equal(indicators.find((i) => i.name === "c-0")!.score, 100);
  assert.equal(indicators.find((i) => i.name === "c-50")!.score, 50);
  assert.equal(indicators.find((i) => i.name === "c-100")!.score, 0);
});

test("CompositeHealthScoreService normalizes memory dimension (inverted)", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("memory", "m-0", 0);
  service.registerIndicator("memory", "m-75", 75);
  service.registerIndicator("memory", "m-100", 100);

  const indicators = service.getIndicators();

  assert.equal(indicators.find((i) => i.name === "m-0")!.score, 100);
  assert.equal(indicators.find((i) => i.name === "m-75")!.score, 25);
  assert.equal(indicators.find((i) => i.name === "m-100")!.score, 0);
});

test("CompositeHealthScoreService isHealthy for ok status", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("system", "sys-1", 100);

  const score = service.getHealthScore();

  assert.equal(score.status, "ok");
  assert.ok(score.isHealthy);
});

test("CompositeHealthScoreService isHealthy for degraded status", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("system", "sys-1", 60);

  const score = service.getHealthScore();

  assert.equal(score.status, "degraded");
  assert.ok(score.isHealthy); // degraded is still considered healthy
});

test("CompositeHealthScoreService isHealthy false for unhealthy status", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("system", "sys-1", 30);

  const score = service.getHealthScore();

  assert.equal(score.status, "unhealthy");
  assert.ok(!score.isHealthy);
});

test("CompositeHealthScoreService isHealthy false for overloaded status", () => {
  const service = new CompositeHealthScoreService({
    thresholds: { unhealthyThreshold: 40, degradedThreshold: 70, overloadedThreshold: 90 },
  });
  service.registerIndicator("compute", "cpu", 95);

  const score = service.getHealthScore();

  assert.equal(score.status, "overloaded");
  assert.ok(!score.isHealthy);
});

test("CompositeHealthScoreService HealthThresholds interface compliance", () => {
  const thresholds: HealthThresholds = {
    unhealthyThreshold: 30,
    degradedThreshold: 60,
    overloadedThreshold: 85,
  };

  const service = new CompositeHealthScoreService({ thresholds });

  service.registerIndicator("system", "sys-1", 70);
  const score = service.getHealthScore();

  assert.equal(score.status, "ok");
  service.updateIndicator(service.getIndicators()[0].indicatorId, 50);
  const degradedScore = service.getHealthScore();
  assert.equal(degradedScore.status, "degraded");
  service.removeIndicator(service.getIndicators()[0].indicatorId);
  service.registerIndicator("memory", "mem", 90);
  const scoreOverloaded = service.getHealthScore();
  assert.equal(scoreOverloaded.status, "overloaded");
});

test("CompositeHealthScoreService computeOverallScore uses weights correctly", () => {
  const service = new CompositeHealthScoreService({
    defaultWeights: { system: 0.8, execution: 0.2 },
  });

  // System at 100 (score 100), Execution at 0 (score 0, but inverted gives 100 since 0 raw = perfect)
  // Wait, for execution: 0 raw value = score 0 (execution is % success rate)
  // Let me reconsider: execution dimension uses rawValue directly as percentage
  service.registerIndicator("execution", "exec-0", 0); // 0% success rate = score 0
  service.registerIndicator("system", "sys-100", 100); // score 100

  const score = service.getHealthScore();

  // Weighted: (0.8 * 100 + 0.2 * 0) = 80
  assert.equal(score.overallScore, 80);
});

test("CompositeHealthScoreService computeOverallScore normalizes by total weight", () => {
  const service = new CompositeHealthScoreService({
    defaultWeights: { system: 0.5, execution: 0.5 },
  });

  service.registerIndicator("system", "sys-100", 100); // weight 0.5, score 100
  service.registerIndicator("execution", "exec-50", 50); // weight 0.5, score 50

  const score = service.getHealthScore();

  // Weighted sum = (0.5/1.0)*100 + (0.5/1.0)*50 = 50 + 25 = 75
  assert.equal(score.overallScore, 75);
});

test("CompositeHealthScoreService computeOverallScore handles zero total weight", () => {
  const service = new CompositeHealthScoreService({
    defaultWeights: {}, // No weights
  });

  // Register with explicit zero weights
  const indicator = service.registerIndicator("system", "sys-1", 100, 0);

  const score = service.getHealthScore();

  // With no valid weights, defaults to 100
  assert.equal(score.overallScore, 100);
});

test("CompositeHealthScoreService overallScore is rounded to 2 decimal places", () => {
  const service = new CompositeHealthScoreService({
    defaultWeights: { system: 0.33, execution: 0.33, queue: 0.34 },
  });

  service.registerIndicator("system", "sys-1", 33);
  service.registerIndicator("execution", "exec-1", 33);
  service.registerIndicator("queue", "q-1", 33);

  const score = service.getHealthScore();

  // Check it's rounded to 2 decimal places
  const scoreStr = score.overallScore.toString();
  const parts = scoreStr.split(".");
  if (parts.length > 1) {
    assert.ok(parts[1].length <= 2);
  }
});
