/**
 * Composite Health Score Service Tests
 *
 * Tests for the composite health score service that computes weighted
 * multi-dimensional health scores from multiple indicators.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CompositeHealthScoreService, type HealthDimension } from "../../../src/platform/stability/composite-health-score-service.js";

test("CompositeHealthScoreService registers indicators and computes health score", () => {
  const service = new CompositeHealthScoreService();

  // Register indicators for different dimensions
  service.registerIndicator("system", "cpu_health", 85);
  service.registerIndicator("execution", "task_success_rate", 95);
  service.registerIndicator("queue", "queue_depth", 20); // Lower is better (20% = 80 score)
  service.registerIndicator("storage", "storage_usage", 30); // Lower is better
  service.registerIndicator("network", "latency_ms", 50); // Lower is better
  service.registerIndicator("compute", "cpu_usage", 25);
  service.registerIndicator("memory", "memory_usage", 40);

  const score = service.getHealthScore();

  assert.ok(score.overallScore > 0, "Should have overall score");
  assert.ok(score.overallScore <= 100, "Score should be capped at 100");
  assert.equal(score.indicators.length, 7, "Should have 7 indicators");
  assert.ok(Object.keys(score.dimensionScores).length === 7, "Should have dimension scores");
});

test("CompositeHealthScoreService returns cached score without recomputation", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("system", "cpu_health", 80);
  service.registerIndicator("execution", "task_success_rate", 90);

  const score1 = service.getHealthScore();
  const score2 = service.getHealthScore();

  // Same object reference due to caching
  assert.equal(score1, score2, "Should return cached score");
});

test("CompositeHealthScoreService recomputes when forced", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("system", "cpu_health", 80);
  service.registerIndicator("execution", "task_success_rate", 90);

  const score1 = service.getHealthScore();
  const score2 = service.getHealthScore(true); // Force recompute

  assert.notEqual(score1, score2, "Should recompute when forced");
});

test("CompositeHealthScoreService updates indicator values", () => {
  const service = new CompositeHealthScoreService();

  const indicator = service.registerIndicator("system", "cpu_health", 80);
  const initialScore = service.getHealthScore();

  service.updateIndicator(indicator.indicatorId, 50);

  const updatedScore = service.getHealthScore(true);
  assert.ok(updatedScore.overallScore !== initialScore.overallScore, "Score should change after update");
});

test("CompositeHealthScoreService removes indicators", () => {
  const service = new CompositeHealthScoreService();

  const ind = service.registerIndicator("system", "cpu_health", 80);
  service.registerIndicator("execution", "task_success_rate", 90);

  const scoreBefore = service.getHealthScore();
  assert.equal(scoreBefore.indicators.length, 2);

  service.removeIndicator(ind.indicatorId);

  const scoreAfter = service.getHealthScore();
  assert.equal(scoreAfter.indicators.length, 1, "Should have one less indicator");
});

test("CompositeHealthScoreService filters indicators by dimension", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("system", "cpu_health", 80);
  service.registerIndicator("system", "disk_health", 90);
  service.registerIndicator("execution", "task_success_rate", 95);

  const systemIndicators = service.getIndicatorsByDimension("system");
  assert.equal(systemIndicators.length, 2, "Should have 2 system indicators");

  const executionIndicators = service.getIndicatorsByDimension("execution");
  assert.equal(executionIndicators.length, 1, "Should have 1 execution indicator");
});

test("CompositeHealthScoreService computes correct status thresholds", () => {
  const service = new CompositeHealthScoreService({
    thresholds: {
      unhealthyThreshold: 40,
      degradedThreshold: 70,
      overloadedThreshold: 90,
    },
  });

  // Register single indicator with controlled score
  const indicator = service.registerIndicator("execution", "task_success_rate", 30);

  // Update to unhealthy level
  service.updateIndicator(indicator.indicatorId, 30); // Score 30
  let score = service.getHealthScore(true);
  assert.equal(score.status, "unhealthy", "Score 30 should be unhealthy");

  // Update to degraded level
  service.updateIndicator(indicator.indicatorId, 55); // Score 55
  score = service.getHealthScore(true);
  assert.equal(score.status, "degraded", "Score 55 should be degraded");

  // Update to ok level
  service.updateIndicator(indicator.indicatorId, 75); // Score 75
  score = service.getHealthScore(true);
  assert.equal(score.status, "ok", "Score 75 should be ok");

  // Update to overloaded level
  service.updateIndicator(indicator.indicatorId, 95); // Score 95
  score = service.getHealthScore(true);
  assert.equal(score.status, "overloaded", "Score 95 should be overloaded");
});

test("CompositeHealthScoreService normalizes queue dimension correctly", () => {
  const service = new CompositeHealthScoreService();

  // Queue depth: lower is better
  // 0 = empty = 100 score, 100 = full = 0 score
  const emptyIndicator = service.registerIndicator("queue", "empty_queue", 0);
  assert.equal(emptyIndicator.score, 100, "Empty queue should score 100");

  const halfIndicator = service.registerIndicator("queue", "half_queue", 50);
  assert.equal(halfIndicator.score, 50, "50% queue should score 50");

  const fullIndicator = service.registerIndicator("queue", "full_queue", 100);
  assert.equal(fullIndicator.score, 0, "Full queue should score 0");
});

test("CompositeHealthScoreService normalizes network latency correctly", () => {
  const service = new CompositeHealthScoreService();

  // Network latency: lower is better
  // 0ms = 100, 1000ms+ = 0
  const lowLatency = service.registerIndicator("network", "low_latency", 0);
  assert.equal(lowLatency.score, 100, "0ms latency should score 100");

  const midLatency = service.registerIndicator("network", "mid_latency", 500);
  assert.equal(midLatency.score, 50, "500ms latency should score 50");

  const highLatency = service.registerIndicator("network", "high_latency", 1000);
  assert.equal(highLatency.score, 0, "1000ms latency should score 0");
});

test("CompositeHealthScoreService returns isHealthy correctly", () => {
  const service = new CompositeHealthScoreService();

  const indicator = service.registerIndicator("execution", "task_success_rate", 30);

  service.updateIndicator(indicator.indicatorId, 30);
  let score = service.getHealthScore(true);
  assert.equal(score.isHealthy, false, "Unhealthy status should not be healthy");

  service.updateIndicator(indicator.indicatorId, 80);
  score = service.getHealthScore(true);
  assert.equal(score.isHealthy, true, "Ok status should be healthy");

  service.updateIndicator(indicator.indicatorId, 65);
  score = service.getHealthScore(true);
  assert.equal(score.isHealthy, true, "Degraded status should still be considered healthy");
});

test("CompositeHealthScoreService computes dimension scores", () => {
  const service = new CompositeHealthScoreService();

  // Add multiple indicators to same dimension
  service.registerIndicator("system", "cpu", 80);
  service.registerIndicator("system", "disk", 60);
  // Average should be 70

  const score = service.getHealthScore();

  assert.ok(score.dimensionScores.system > 0, "System dimension should have score");
  assert.ok(score.dimensionScores.execution === 100, "Execution with no indicators should default to 100");
});

test("CompositeHealthScoreService handles empty indicators", () => {
  const service = new CompositeHealthScoreService();

  const score = service.getHealthScore();

  assert.equal(score.overallScore, 100, "No indicators should return healthy score");
  assert.equal(score.indicators.length, 0, "Should have no indicators");
  assert.equal(score.isHealthy, true, "Should be healthy with no indicators");
});

test("CompositeHealthScoreService uses custom weights", () => {
  const service = new CompositeHealthScoreService({
    defaultWeights: {
      system: 0.5,
      execution: 0.5,
      queue: 0,
      storage: 0,
      network: 0,
      compute: 0,
      memory: 0,
    },
  });

  service.registerIndicator("system", "cpu", 80); // Score 80
  service.registerIndicator("execution", "task_success", 60); // Score 60

  const score = service.getHealthScore();

  // Weighted: (0.5 * 80 + 0.5 * 60) / (0.5 + 0.5) = 70
  assert.equal(score.overallScore, 70, "Weighted score should be 70");
});

test("CompositeHealthScoreService has trace ID for debugging", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("system", "cpu", 80);

  const score = service.getHealthScore();

  assert.ok(score.traceId.length > 0, "Should have trace ID");
});

test("CompositeHealthScoreService has computedAt timestamp", () => {
  const service = new CompositeHealthScoreService();

  service.registerIndicator("system", "cpu", 80);

  const score = service.getHealthScore();

  assert.ok(score.computedAt.length > 0, "Should have computedAt timestamp");
});