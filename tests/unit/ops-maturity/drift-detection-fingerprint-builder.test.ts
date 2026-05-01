import assert from "node:assert/strict";
import test from "node:test";
import {
  BehaviorFingerprintBuilder,
  FINGERPRINT_WINDOW_SIZES,
  type BehaviorFingerprintInput,
} from "../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";

test("BehaviorFingerprintBuilder build creates fingerprint with correct structure", () => {
  const input: BehaviorFingerprintInput = {
    agentId: "agent_test",
    tools: ["tool_a", "tool_b"],
    failureCategories: ["schema_error", "type_error"],
    averageLatencyMs: 1500,
    averageCostUsd: 0.5,
    window: "1h",
    avgStepCount: 10,
    toolUsageDistribution: { tool_a: 5, tool_b: 5 },
    successRate: 0.95,
    riskDistribution: { low: 80, medium: 15, high: 5, critical: 0 },
    driftScore: 0.1,
  };

  const builder = new BehaviorFingerprintBuilder();
  const fingerprint = builder.build(input);

  assert.strictEqual(fingerprint.fingerprintId, "fingerprint:agent_test");
  assert.strictEqual(fingerprint.subjectType, "agent");
  assert.strictEqual(fingerprint.window, "1h");
  assert.strictEqual(fingerprint.avgStepCount, 10);
  assert.strictEqual(fingerprint.baselineRef, null);
  assert.ok(fingerprint.hash.length > 0);
});

test("BehaviorFingerprintBuilder build buckets latency correctly", () => {
  const builder = new BehaviorFingerprintBuilder();

  const fastFingerprint = builder.build({
    agentId: "agent_fast",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 500,
    averageCostUsd: 0.1,
    window: "1h",
    avgStepCount: 5,
  });

  assert.ok(fastFingerprint.behaviorFeatures.some((f) => f.includes("fast")));

  const slowFingerprint = builder.build({
    agentId: "agent_slow",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 10000,
    averageCostUsd: 0.1,
    window: "1h",
    avgStepCount: 5,
  });

  assert.ok(slowFingerprint.behaviorFeatures.some((f) => f.includes("slow")));
});

test("BehaviorFingerprintBuilder build buckets cost correctly", () => {
  const builder = new BehaviorFingerprintBuilder();

  const lowCostFingerprint = builder.build({
    agentId: "agent_low_cost",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.05,
    window: "1h",
    avgStepCount: 5,
  });

  assert.ok(lowCostFingerprint.behaviorFeatures.some((f) => f.includes("low")));

  const highCostFingerprint = builder.build({
    agentId: "agent_high_cost",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 5.0,
    window: "1h",
    avgStepCount: 5,
  });

  assert.ok(highCostFingerprint.behaviorFeatures.some((f) => f.includes("high")));
});

test("BehaviorFingerprintBuilder build includes all window sizes", () => {
  assert.deepStrictEqual(FINGERPRINT_WINDOW_SIZES, ["1h", "7d", "30d", "90d"]);
});

test("BehaviorFingerprintBuilder build uses defaults for optional fields", () => {
  const builder = new BehaviorFingerprintBuilder();
  const fingerprint = builder.build({
    agentId: "agent_minimal",
    tools: ["tool_a"],
    failureCategories: [],
    averageLatencyMs: 1000,
    averageCostUsd: 0.5,
    window: "7d",
    avgStepCount: 3,
  });

  assert.strictEqual(fingerprint.normalizedFeatures.some((f) => f.includes("success_rate:0")), true);
  assert.strictEqual(fingerprint.normalizedFeatures.some((f) => f.includes("drift_score:0")), true);
});

test("BehaviorFingerprintBuilder build generates unique hashes for different inputs", () => {
  const builder = new BehaviorFingerprintBuilder();

  const fp1 = builder.build({
    agentId: "agent_1",
    tools: ["tool_a"],
    failureCategories: [],
    averageLatencyMs: 1000,
    averageCostUsd: 0.5,
    window: "7d",
    avgStepCount: 3,
  });

  const fp2 = builder.build({
    agentId: "agent_2",
    tools: ["tool_a"],
    failureCategories: [],
    averageLatencyMs: 1000,
    averageCostUsd: 0.5,
    window: "7d",
    avgStepCount: 3,
  });

  assert.notStrictEqual(fp1.hash, fp2.hash);
});

test("BehaviorFingerprintBuilder build generates same hash for same input", () => {
  const builder = new BehaviorFingerprintBuilder();

  const input: BehaviorFingerprintInput = {
    agentId: "agent_same",
    tools: ["tool_x"],
    failureCategories: ["error_a"],
    averageLatencyMs: 2000,
    averageCostUsd: 1.0,
    window: "30d",
    avgStepCount: 7,
  };

  const fp1 = builder.build(input);
  const fp2 = builder.build(input);

  assert.strictEqual(fp1.hash, fp2.hash);
});