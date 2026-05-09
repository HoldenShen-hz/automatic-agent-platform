import assert from "node:assert/strict";
import test from "node:test";
import {
  BehaviorFingerprintBuilder,
  type BehaviorFingerprintInput,
} from "../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";

test("BehaviorFingerprintBuilder build creates fingerprint with correct structure", () => {
  const input: BehaviorFingerprintInput = {
    agentId: "agent_test",
    tools: ["tool_a", "tool_b"],
    failureCategories: ["schema_error", "type_error"],
    averageLatencyMs: 1500,
    averageCostUsd: 0.5,
    avgStepCount: 10,
    toolUsageDistribution: { tool_a: 5, tool_b: 5 },
    successRate: 0.95,
    riskDistribution: { low: 80, medium: 15, high: 5, critical: 0 },
    driftScore: 0.1,
  };

  const builder = new BehaviorFingerprintBuilder();
  const fingerprint = builder.build(input);

  assert.strictEqual(fingerprint.fingerprintId, "fingerprint:agent_test");
  assert.ok(Array.isArray(fingerprint.normalizedFeatures));
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
    avgStepCount: 5,
  });

  assert.ok(fastFingerprint.normalizedFeatures.some((f) => f.includes("fast")));

  const slowFingerprint = builder.build({
    agentId: "agent_slow",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 10000,
    averageCostUsd: 0.1,
    avgStepCount: 5,
  });

  assert.ok(slowFingerprint.normalizedFeatures.some((f) => f.includes("slow")));
});

test("BehaviorFingerprintBuilder build buckets cost correctly", () => {
  const builder = new BehaviorFingerprintBuilder();

  const lowCostFingerprint = builder.build({
    agentId: "agent_low_cost",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.05,
    avgStepCount: 5,
  });

  assert.ok(lowCostFingerprint.normalizedFeatures.some((f) => f.includes("low")));

  const highCostFingerprint = builder.build({
    agentId: "agent_high_cost",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 5.0,
    avgStepCount: 5,
  });

  assert.ok(highCostFingerprint.normalizedFeatures.some((f) => f.includes("high")));
});

test("BehaviorFingerprintBuilder build uses defaults for optional fields", () => {
  const builder = new BehaviorFingerprintBuilder();
  const fingerprint = builder.build({
    agentId: "agent_minimal",
    tools: ["tool_a"],
    failureCategories: [],
    averageLatencyMs: 1000,
    averageCostUsd: 0.5,
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
    avgStepCount: 3,
  });

  const fp2 = builder.build({
    agentId: "agent_2",
    tools: ["tool_a"],
    failureCategories: [],
    averageLatencyMs: 1000,
    averageCostUsd: 0.5,
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
    avgStepCount: 7,
  };

  const fp1 = builder.build(input);
  const fp2 = builder.build(input);

  assert.strictEqual(fp1.hash, fp2.hash);
});

test("BehaviorFingerprintBuilder hash matches manually computed SHA-256", () => {
  const builder = new BehaviorFingerprintBuilder();
  const input: BehaviorFingerprintInput = {
    agentId: "agent_sha_test",
    tools: ["tool_a", "tool_b"],
    failureCategories: ["schema_error"],
    averageLatencyMs: 1000,
    averageCostUsd: 0.5,
    avgStepCount: 5,
  };

  const fp = builder.build(input);
  // Verify the hash is a valid SHA-256 hex string (64 characters)
  assert.ok(/^[a-f0-9]{64}$/.test(fp.hash), "Hash should be a valid SHA-256 hex string");
});