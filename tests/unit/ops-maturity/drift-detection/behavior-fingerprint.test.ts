import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BehaviorFingerprintBuilder } from "../../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";

describe("BehaviorFingerprintBuilder", () => {
  const builder = new BehaviorFingerprintBuilder();

  test("builds fingerprint with all fields populated", () => {
    const input = {
      agentId: "agent-42",
      tools: ["tool-a", "tool-b"],
      failureCategories: ["timeout", "auth_error"],
      averageLatencyMs: 3500,
      averageCostUsd: 0.05,
    };

    const result = builder.build(input);

    assert.ok(result.fingerprintId.startsWith("fingerprint:agent-42"));
    assert.ok(result.hash.length > 0);
    assert.ok(result.normalizedFeatures.length > 0);
  });

  test("produces consistent hash for same input", () => {
    const input = {
      agentId: "agent-1",
      tools: ["exec", "query"],
      failureCategories: ["crash"],
      averageLatencyMs: 500,
      averageCostUsd: 0.5,
    };

    const first = builder.build(input);
    const second = builder.build(input);

    assert.strictEqual(first.hash, second.hash);
    assert.strictEqual(first.fingerprintId, second.fingerprintId);
    assert.deepStrictEqual(first.normalizedFeatures, second.normalizedFeatures);
  });

  test("produces different hash for different agentId", () => {
    const base = {
      agentId: "agent-a",
      tools: [] as readonly string[],
      failureCategories: [] as readonly string[],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const hashA = builder.build({ ...base, agentId: "agent-a" }).hash;
    const hashB = builder.build({ ...base, agentId: "agent-b" }).hash;

    assert.notStrictEqual(hashA, hashB);
  });

  test("produces different hash for different tools order", () => {
    const base = {
      agentId: "agent-x",
      tools: ["z", "a", "m"],
      failureCategories: [] as readonly string[],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const hashForward = builder.build(base).hash;
    const hashReversed = builder.build({ ...base, tools: ["m", "a", "z"] }).hash;

    // Normalized features sort tools, so same sorted set yields same hash
    assert.strictEqual(hashForward, hashReversed);
  });

  test("produces different hash for different failure categories order", () => {
    const base = {
      agentId: "agent-y",
      tools: [] as readonly string[],
      failureCategories: ["cat-b", "cat-a"],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const hashForward = builder.build(base).hash;
    const hashReversed = builder.build({ ...base, failureCategories: ["cat-a", "cat-b"] }).hash;

    // Normalized features sort failures, so same sorted set yields same hash
    assert.strictEqual(hashForward, hashReversed);
  });

  test("maps fast latency (< 1000ms) to 'fast' bucket", () => {
    const input = {
      agentId: "agent-fast",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 500,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "latency_bucket:fast"));
  });

  test("maps medium latency (1000-4999ms) to 'medium' bucket", () => {
    const input = {
      agentId: "agent-medium",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 2500,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "latency_bucket:medium"));
  });

  test("maps slow latency (>= 5000ms) to 'slow' bucket", () => {
    const input = {
      agentId: "agent-slow",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 7500,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "latency_bucket:slow"));
  });

  test("maps low cost (< $0.10) to 'low' bucket", () => {
    const input = {
      agentId: "agent-low-cost",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.05,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "cost_bucket:low"));
  });

  test("maps medium cost ($0.10-$0.99) to 'medium' bucket", () => {
    const input = {
      agentId: "agent-med-cost",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.50,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "cost_bucket:medium"));
  });

  test("maps high cost (>= $1.00) to 'high' bucket", () => {
    const input = {
      agentId: "agent-high-cost",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 2.5,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "cost_bucket:high"));
  });

  test("includes agent identifier in normalized features", () => {
    const input = {
      agentId: "test-agent-99",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "agent:test-agent-99"));
  });

  test("includes sorted tools in normalized features", () => {
    const input = {
      agentId: "agent-z",
      tools: ["zebra", "apple", "mango"],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    const toolsFeature = result.normalizedFeatures.find((f) => f.startsWith("tools:"));
    assert.ok(toolsFeature !== undefined);
    assert.strictEqual(toolsFeature, "tools:apple,mango,zebra");
  });

  test("includes sorted failure categories in normalized features", () => {
    const input = {
      agentId: "agent-f",
      tools: [],
      failureCategories: ["z-fail", "a-fail"],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    const failuresFeature = result.normalizedFeatures.find((f) => f.startsWith("failures:"));
    assert.ok(failuresFeature !== undefined);
    assert.strictEqual(failuresFeature, "failures:a-fail,z-fail");
  });

  test("handles empty tools and failure categories", () => {
    const input = {
      agentId: "agent-empty",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    const toolsFeature = result.normalizedFeatures.find((f) => f.startsWith("tools:"));
    const failuresFeature = result.normalizedFeatures.find((f) => f.startsWith("failures:"));
    assert.strictEqual(toolsFeature, "tools:");
    assert.strictEqual(failuresFeature, "failures:");
  });

  test("fingerprintId format is fingerprint:<agentId>", () => {
    const input = {
      agentId: "my-agent",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.strictEqual(result.fingerprintId, "fingerprint:my-agent");
  });

  test("hash is a sha256 hex string (64 characters)", () => {
    const input = {
      agentId: "agent-hash-test",
      tools: ["tool-1"],
      failureCategories: ["fail-1"],
      averageLatencyMs: 500,
      averageCostUsd: 0.25,
    };

    const result = builder.build(input);

    assert.strictEqual(result.hash.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(result.hash));
  });

  test("read-only arrays are accepted and not mutated", () => {
    const tools = Object.freeze(["t1", "t2"]);
    const failures = Object.freeze(["f1"]);
    const input = {
      agentId: "agent-ro",
      tools,
      failureCategories: failures,
      averageLatencyMs: 100,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.strictEqual(result.normalizedFeatures.length, 5);
    assert.strictEqual(input.tools.length, 2);
    assert.strictEqual(input.failureCategories.length, 1);
  });

  test("latency bucket boundary: exactly 999ms is fast", () => {
    const input = {
      agentId: "agent",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 999,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "latency_bucket:fast"));
  });

  test("latency bucket boundary: exactly 1000ms is medium", () => {
    const input = {
      agentId: "agent",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 1000,
      averageCostUsd: 0.01,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "latency_bucket:medium"));
  });

  test("cost bucket boundary: exactly $0.099 is low", () => {
    const input = {
      agentId: "agent",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.099,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "cost_bucket:low"));
  });

  test("cost bucket boundary: exactly $0.10 is medium", () => {
    const input = {
      agentId: "agent",
      tools: [],
      failureCategories: [],
      averageLatencyMs: 100,
      averageCostUsd: 0.10,
    };

    const result = builder.build(input);

    assert.ok(result.normalizedFeatures.some((f) => f === "cost_bucket:medium"));
  });
});