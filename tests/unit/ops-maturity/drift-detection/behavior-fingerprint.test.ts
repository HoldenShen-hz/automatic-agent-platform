/**
 * Unit tests for BehaviorFingerprintBuilder
 *
 * @see src/ops-maturity/drift-detection/fingerprint-builder/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { BehaviorFingerprintBuilder } from "../../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";

test("BehaviorFingerprintBuilder produces correct fingerprintId format", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "agent-abc",
    tools: ["read"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.equal(result.fingerprintId, "fingerprint:agent-abc");
});

test("BehaviorFingerprintBuilder generates SHA-256 hash (64 hex characters)", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "agent-hash-test",
    tools: ["read"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.equal(result.hash.length, 64);
  assert.match(result.hash, /^[a-f0-9]+$/);
});

test("BehaviorFingerprintBuilder normalizes tools to sorted comma-separated string", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "agent-tools",
    tools: ["zap", "alpha", "beta"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  const toolsFeature = result.normalizedFeatures.find((f) => f.startsWith("tools:"));
  assert.ok(toolsFeature);
  assert.equal(toolsFeature, "tools:alpha,beta,zap");
});

test("BehaviorFingerprintBuilder normalizes failureCategories to sorted comma-separated string", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "agent-failures",
    tools: [],
    failureCategories: ["z_error", "a_error"],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  const failuresFeature = result.normalizedFeatures.find((f) => f.startsWith("failures:"));
  assert.ok(failuresFeature);
  assert.equal(failuresFeature, "failures:a_error,z_error");
});

test("BehaviorFingerprintBuilder buckets latency as fast when below 1000ms", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "fast-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 500,
    averageCostUsd: 0.01,
  });

  assert.ok(result.normalizedFeatures.includes("latency_bucket:fast"));
});

test("BehaviorFingerprintBuilder buckets latency as medium when between 1000ms and 5000ms", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "medium-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 3000,
    averageCostUsd: 0.01,
  });

  assert.ok(result.normalizedFeatures.includes("latency_bucket:medium"));
});

test("BehaviorFingerprintBuilder buckets latency as slow when 5000ms or above", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "slow-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 5000,
    averageCostUsd: 0.01,
  });

  assert.ok(result.normalizedFeatures.includes("latency_bucket:slow"));
});

test("BehaviorFingerprintBuilder buckets latency as slow when above 5000ms", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "very-slow-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 10000,
    averageCostUsd: 0.01,
  });

  assert.ok(result.normalizedFeatures.includes("latency_bucket:slow"));
});

test("BehaviorFingerprintBuilder buckets cost as low when below 0.1", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "cheap-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.05,
  });

  assert.ok(result.normalizedFeatures.includes("cost_bucket:low"));
});

test("BehaviorFingerprintBuilder buckets cost as medium when between 0.1 and 1", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "moderate-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.5,
  });

  assert.ok(result.normalizedFeatures.includes("cost_bucket:medium"));
});

test("BehaviorFingerprintBuilder buckets cost as high when 1 or above", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "expensive-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 1.0,
  });

  assert.ok(result.normalizedFeatures.includes("cost_bucket:high"));
});

test("BehaviorFingerprintBuilder handles empty tools array", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "empty-tools-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  const toolsFeature = result.normalizedFeatures.find((f) => f.startsWith("tools:"));
  assert.ok(toolsFeature);
  assert.equal(toolsFeature, "tools:");
});

test("BehaviorFingerprintBuilder handles empty failureCategories array", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "empty-failures-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  const failuresFeature = result.normalizedFeatures.find((f) => f.startsWith("failures:"));
  assert.ok(failuresFeature);
  assert.equal(failuresFeature, "failures:");
});

test("BehaviorFingerprintBuilder produces deterministic hash for same input", () => {
  const builder = new BehaviorFingerprintBuilder();
  const input = {
    agentId: "deterministic-agent",
    tools: ["read", "edit"] as const,
    failureCategories: ["timeout"] as const,
    averageLatencyMs: 2000,
    averageCostUsd: 0.5,
  };

  const result1 = builder.build(input);
  const result2 = builder.build(input);

  assert.equal(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder produces different hash for different agentId", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result1 = builder.build({
    agentId: "agent-a",
    tools: ["read"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });
  const result2 = builder.build({
    agentId: "agent-b",
    tools: ["read"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.notEqual(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder produces different hash when tools differ", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result1 = builder.build({
    agentId: "same-agent",
    tools: ["read"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });
  const result2 = builder.build({
    agentId: "same-agent",
    tools: ["read", "edit"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.notEqual(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder produces different hash when failureCategories differ", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result1 = builder.build({
    agentId: "same-agent",
    tools: [],
    failureCategories: ["error_a"],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });
  const result2 = builder.build({
    agentId: "same-agent",
    tools: [],
    failureCategories: ["error_b"],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.notEqual(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder produces different hash when latency differs across buckets", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result1 = builder.build({
    agentId: "same-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 500,
    averageCostUsd: 0.01,
  });
  const result2 = builder.build({
    agentId: "same-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 1500,
    averageCostUsd: 0.01,
  });

  assert.notEqual(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder produces different hash when cost differs across buckets", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result1 = builder.build({
    agentId: "same-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.05,
  });
  const result2 = builder.build({
    agentId: "same-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.5,
  });

  assert.notEqual(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder produces same hash regardless of tool order (sorting)", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result1 = builder.build({
    agentId: "sorted-agent",
    tools: ["zap", "alpha", "beta"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });
  const result2 = builder.build({
    agentId: "sorted-agent",
    tools: ["alpha", "beta", "zap"],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.equal(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder produces same hash regardless of failureCategory order (sorting)", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result1 = builder.build({
    agentId: "sorted-agent",
    tools: [],
    failureCategories: ["z_error", "a_error"],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });
  const result2 = builder.build({
    agentId: "sorted-agent",
    tools: [],
    failureCategories: ["a_error", "z_error"],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.equal(result1.hash, result2.hash);
});

test("BehaviorFingerprintBuilder returns all normalized features including agent, tools, failures, latency, cost", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "full-agent",
    tools: ["read", "edit"],
    failureCategories: ["timeout"],
    averageLatencyMs: 2000,
    averageCostUsd: 0.5,
  });

  assert.equal(result.normalizedFeatures.length, 5);
  assert.ok(result.normalizedFeatures.includes("agent:full-agent"));
  assert.ok(result.normalizedFeatures.includes("tools:edit,read"));
  assert.ok(result.normalizedFeatures.includes("failures:timeout"));
  assert.ok(result.normalizedFeatures.includes("latency_bucket:medium"));
  assert.ok(result.normalizedFeatures.includes("cost_bucket:medium"));
});

test("BehaviorFingerprintBuilder hash matches manually computed SHA-256", () => {
  const builder = new BehaviorFingerprintBuilder();
  const result = builder.build({
    agentId: "verify-agent",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  // The hash should be SHA-256 of the normalized features joined by "|"
  const expectedHash = createHash("sha256")
    .update("agent:verify-agent|tools:|failures:|latency_bucket:fast|cost_bucket:low")
    .digest("hex");

  assert.equal(result.hash, expectedHash);
});

test("BehaviorFingerprintBuilder does not mutate original input arrays", () => {
  const builder = new BehaviorFingerprintBuilder();
  const originalTools = ["edit", "read"];
  const originalFailures = ["error"];

  builder.build({
    agentId: "immutable-agent",
    tools: originalTools,
    failureCategories: originalFailures,
    averageLatencyMs: 100,
    averageCostUsd: 0.01,
  });

  assert.deepEqual(originalTools, ["edit", "read"]);
  assert.deepEqual(originalFailures, ["error"]);
});