import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  resolveRegionFailover,
  type RegionFailoverInput,
} from "../../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

function mockFailoverInput(overrides: Partial<RegionFailoverInput> = {}): RegionFailoverInput {
  return {
    primaryHealthy: true,
    candidateRegionIds: ["region-2", "region-3"],
    ...overrides,
  };
}

test("resolveRegionFailover returns no failover when primary is healthy and no issues [failover-controller]", () => {
  const input = mockFailoverInput({ primaryHealthy: true });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, false);
  assert.strictEqual(result.targetRegionId, null);
  assert.strictEqual(result.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover triggers failover when primary is unhealthy [failover-controller]", () => {
  const input = mockFailoverInput({ primaryHealthy: false });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, true);
  assert.strictEqual(result.targetRegionId, "region-2");
  assert.strictEqual(result.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover triggers failover when latency is breached [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 200,
    maxAcceptableLatencyMs: 100,
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, true);
  assert.strictEqual(result.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover triggers failover when error rate is breached [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, true);
  assert.strictEqual(result.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover uses preferred region when available [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "region-3",
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, true);
  assert.strictEqual(result.targetRegionId, "region-3");
});

test("resolveRegionFailover returns no failover when no candidates [failover-controller]", () => {
  const input = mockFailoverInput({ primaryHealthy: false, candidateRegionIds: [] });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, false);
  assert.strictEqual(result.targetRegionId, null);
  assert.strictEqual(result.rationale, "multi_region.no_candidate_available");
});

test("resolveRegionFailover handles missing optional parameters [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: false,
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, true);
});

test("resolveRegionFailover latency check requires both values [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 200,
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, false);
});

test("resolveRegionFailover error rate check requires both values [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0.1,
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, false);
});

test("resolveRegionFailover prefers preferred region even when unhealthy [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "region-3",
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.targetRegionId, "region-3");
});

test("resolveRegionFailover falls back to first candidate when preferred not in candidates [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "nonexistent-region",
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.targetRegionId, "region-2");
});

test("resolveRegionFailover all degraded conditions trigger failover [failover-controller]", () => {
  const input = mockFailoverInput({
    primaryHealthy: false,
    primaryLatencyMs: 500,
    maxAcceptableLatencyMs: 100,
    primaryErrorRate: 0.15,
    maxAcceptableErrorRate: 0.05,
  });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.shouldFailover, true);
});

test("resolveRegionFailover first candidate is used when no preferred [failover-controller]", () => {
  const input = mockFailoverInput({ primaryHealthy: false });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.targetRegionId, "region-2");
});

test("resolveRegionFailover empty candidates with unhealthy primary gives no_candidate_available [failover-controller]", () => {
  const input = mockFailoverInput({ primaryHealthy: false, candidateRegionIds: [] });

  const result = resolveRegionFailover(input);

  assert.strictEqual(result.rationale, "multi_region.no_candidate_available");
});