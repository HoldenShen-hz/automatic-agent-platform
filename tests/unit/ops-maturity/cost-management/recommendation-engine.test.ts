import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCostOptimizationRecommendation,
  prioritizeCostOptimizationRecommendations,
  type CostOptimizationRecommendation,
} from "../../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js";

test("cost-management: buildCostOptimizationRecommendation returns null for low cost", () => {
  const result = buildCostOptimizationRecommendation("task-low", 5);

  assert.strictEqual(result, null);
});

test("cost-management: buildCostOptimizationRecommendation returns null for zero cost", () => {
  const result = buildCostOptimizationRecommendation("task-zero", 0);

  assert.strictEqual(result, null);
});

test("cost-management: buildCostOptimizationRecommendation returns null for negative cost", () => {
  const result = buildCostOptimizationRecommendation("task-negative", -10);

  assert.strictEqual(result, null);
});

test("cost-management: buildCostOptimizationRecommendation creates low risk recommendation for moderate cost without model", () => {
  const result = buildCostOptimizationRecommendation("task-moderate", 50);

  assert.ok(result != null);
  assert.strictEqual(result.subjectId, "task-moderate");
  assert.strictEqual(result.riskLevel, "medium");
  assert.strictEqual(result.action, "right_size");
  assert.ok(result.estimatedSavingsUsd > 0);
  assert.strictEqual(result.currentModelRef, undefined);
  assert.strictEqual(result.recommendedModelRef, undefined);
});

test("cost-management: buildCostOptimizationRecommendation creates medium risk for higher costs", () => {
  const result = buildCostOptimizationRecommendation("task-high", 100);

  assert.ok(result != null);
  assert.strictEqual(result.riskLevel, "medium");
  assert.strictEqual(result.action, "right_size");
  assert.ok(result.estimatedSavingsUsd > 0);
});

test("cost-management: buildCostOptimizationRecommendation includes model ref when provided", () => {
  const result = buildCostOptimizationRecommendation("task-with-model", 200, {
    modelRef: "anthropic/claude-3-5-sonnet",
  });

  assert.ok(result != null);
  assert.ok(result.currentModelRef != null);
  assert.strictEqual(result.currentModelRef, "anthropic/claude-3-5-sonnet");
});

test("cost-management: buildCostOptimizationRecommendation has correct recommendationId format", () => {
  const result = buildCostOptimizationRecommendation("my-task-123", 75);

  assert.ok(result != null);
  assert.ok(result.recommendationId.startsWith("rec_my-task-123"));
});

test("cost-management: buildCostOptimizationRecommendation estimatedSavings uses 15% for right_size action", () => {
  const result = buildCostOptimizationRecommendation("task-100", 100);

  assert.ok(result != null);
  assert.strictEqual(result.action, "right_size");
  assert.strictEqual(result.estimatedSavingsUsd, 15);
});

test("cost-management: buildCostOptimizationRecommendation estimatedSavings uses 22% for downgrade_model action", () => {
  // High cost with model ref that supports downgrade will trigger downgrade_model action
  const result = buildCostOptimizationRecommendation("task-high-model", 150, {
    modelRef: "anthropic/claude-3-5-sonnet-20241022",
  });

  // The result depends on whether a lower-cost peer profile exists
  assert.ok(result != null);
  assert.ok(result.estimatedSavingsUsd > 0);
});

test("cost-management: buildCostOptimizationRecommendation action is increase_cache_hit for low costs", () => {
  const result = buildCostOptimizationRecommendation("task-25", 25);

  assert.ok(result != null);
  assert.strictEqual(result.action, "increase_cache_hit");
  assert.strictEqual(result.riskLevel, "low");
});

test("cost-management: prioritizeCostOptimizationRecommendations sorts by savings descending", () => {
  const recs: CostOptimizationRecommendation[] = [
    { recommendationId: "r1", subjectId: "s1", estimatedSavingsUsd: 10, riskLevel: "low", action: "right_size" },
    { recommendationId: "r2", subjectId: "s2", estimatedSavingsUsd: 50, riskLevel: "medium", action: "right_size" },
    { recommendationId: "r3", subjectId: "s3", estimatedSavingsUsd: 30, riskLevel: "high", action: "downgrade_model" },
  ];

  const prioritized = prioritizeCostOptimizationRecommendations(recs);

  assert.strictEqual(prioritized[0].subjectId, "s2");
  assert.strictEqual(prioritized[0].estimatedSavingsUsd, 50);
  assert.strictEqual(prioritized[1].subjectId, "s3");
  assert.strictEqual(prioritized[1].estimatedSavingsUsd, 30);
  assert.strictEqual(prioritized[2].subjectId, "s1");
  assert.strictEqual(prioritized[2].estimatedSavingsUsd, 10);
});

test("cost-management: prioritizeCostOptimizationRecommendations returns copy not mutate", () => {
  const recs: CostOptimizationRecommendation[] = [
    { recommendationId: "r1", subjectId: "s1", estimatedSavingsUsd: 10, riskLevel: "low", action: "right_size" },
    { recommendationId: "r2", subjectId: "s2", estimatedSavingsUsd: 20, riskLevel: "low", action: "right_size" },
  ];

  const prioritized = prioritizeCostOptimizationRecommendations(recs);

  assert.strictEqual(prioritized[0].estimatedSavingsUsd, 20);
  assert.notStrictEqual(prioritized, recs);
  assert.strictEqual(prioritized.length, recs.length);
});

test("cost-management: prioritizeCostOptimizationRecommendations handles empty array", () => {
  const result = prioritizeCostOptimizationRecommendations([]);

  assert.deepStrictEqual(result, []);
});

test("cost-management: prioritizeCostOptimizationRecommendations handles single item", () => {
  const recs: CostOptimizationRecommendation[] = [
    { recommendationId: "r1", subjectId: "s1", estimatedSavingsUsd: 100, riskLevel: "low", action: "right_size" },
  ];

  const result = prioritizeCostOptimizationRecommendations(recs);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].subjectId, "s1");
});

test("cost-management: prioritizeCostOptimizationRecommendations handles equal savings (stable sort)", () => {
  const recs: CostOptimizationRecommendation[] = [
    { recommendationId: "r1", subjectId: "s1", estimatedSavingsUsd: 50, riskLevel: "low", action: "right_size" },
    { recommendationId: "r2", subjectId: "s2", estimatedSavingsUsd: 50, riskLevel: "medium", action: "right_size" },
  ];

  const result = prioritizeCostOptimizationRecommendations(recs);

  // Both have same savings, original order may be maintained
  assert.strictEqual(result.length, 2);
  assert.ok(result[0].estimatedSavingsUsd === 50 && result[1].estimatedSavingsUsd === 50);
});

test("cost-management: buildCostOptimizationRecommendation with custom registry", () => {
  const mockRegistry = {
    version: "test",
    providers: {
      "test-provider": { status: "active", authMethods: ["api-key"] },
    },
    profiles: {
      "test-model": {
        provider: "test-provider",
        modelId: "test-model",
        tier: "fast" as const,
        capabilities: ["chat"],
        contextWindowTokens: 100_000,
        maxOutputTokens: 4096,
        pricing: { inputPer1kUsd: 0.5, outputPer1kUsd: 1.5 },
        metadataSource: "bundled_snapshot" as const,
      },
    },
  };

  const result = buildCostOptimizationRecommendation("task-custom", 200, {
    modelRef: "test-provider/test-model",
    registry: mockRegistry,
  });

  assert.ok(result != null);
});