/**
 * Unit tests for multi-region modules in src/scale-ecosystem/multi-region/
 *
 * Tests region routing, failover decision logic, and region health management.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  selectPreferredRegion,
  RegionDescriptorSchema,
  type RegionDescriptor,
} from "../../../src/scale-ecosystem/multi-region/region-router/index.js";
import {
  resolveRegionFailover,
  type RegionFailoverInput,
} from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// selectPreferredRegion Tests
// ─────────────────────────────────────────────────────────────────────────────

test("selectPreferredRegion returns null for empty array", () => {
  const result = selectPreferredRegion([]);
  assert.equal(result, null);
});

test("selectPreferredRegion returns null when all regions disabled", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east", jurisdiction: "US", status: "disabled", latencyScore: 1 },
    { regionId: "eu-west", jurisdiction: "EU", status: "disabled", latencyScore: 2 },
  ];
  const result = selectPreferredRegion(regions);
  assert.equal(result, null);
});

test("selectPreferredRegion filters out disabled regions", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east", jurisdiction: "US", status: "disabled", latencyScore: 1 },
    { regionId: "eu-west", jurisdiction: "EU", status: "active", latencyScore: 50 },
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "eu-west");
});

test("selectPreferredRegion filters out regions with residencyAllowed false", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east", jurisdiction: "US", residencyAllowed: false, latencyScore: 1 },
    { regionId: "eu-west", jurisdiction: "EU", residencyAllowed: true, latencyScore: 50 },
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "eu-west");
});

test("selectPreferredRegion sorts by latencyScore ascending", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "ap-south", jurisdiction: "IN", latencyScore: 150 },
    { regionId: "us-east", jurisdiction: "US", latencyScore: 30 },
    { regionId: "eu-west", jurisdiction: "EU", latencyScore: 80 },
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east");
});

test("selectPreferredRegion handles undefined latencyScore as zero", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east", jurisdiction: "US", latencyScore: undefined as any, status: "active" },
    { regionId: "eu-west", jurisdiction: "EU", latencyScore: 50, status: "active" },
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east");
});

test("selectPreferredRegion handles undefined status as active", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east", jurisdiction: "US", latencyScore: 10, status: undefined as any },
    { regionId: "eu-west", jurisdiction: "EU", latencyScore: 5, status: "active" },
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "eu-west");
});

test("selectPreferredRegion handles degraded but not disabled region", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east", jurisdiction: "US", status: "degraded", latencyScore: 1 },
    { regionId: "eu-west", jurisdiction: "EU", status: "active", latencyScore: 50 },
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east"); // degraded is not disabled
});

// ─────────────────────────────────────────────────────────────────────────────
// RegionDescriptorSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RegionDescriptorSchema accepts valid minimal input", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "us-east",
    jurisdiction: "US",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.regionId, "us-east");
    assert.equal(result.data.countryCode, "XX");
    assert.equal(result.data.status, "active");
    assert.deepEqual(result.data.capabilities, []);
  }
});

test("RegionDescriptorSchema accepts full valid input", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "us-east",
    countryCode: "US",
    jurisdiction: "US",
    capabilities: ["llm", "storage"],
    status: "degraded",
    latencyScore: 42,
    residencyAllowed: false,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "degraded");
    assert.equal(result.data.latencyScore, 42);
    assert.equal(result.data.residencyAllowed, false);
  }
});

test("RegionDescriptorSchema rejects empty regionId", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "",
    jurisdiction: "US",
  });
  assert.equal(result.success, false);
});

test("RegionDescriptorSchema rejects single-char countryCode", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "us-east",
    countryCode: "U",
    jurisdiction: "US",
  });
  assert.equal(result.success, false);
});

test("RegionDescriptorSchema rejects empty jurisdiction", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "us-east",
    jurisdiction: "",
  });
  assert.equal(result.success, false);
});

test("RegionDescriptorSchema rejects negative latencyScore", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "us-east",
    jurisdiction: "US",
    latencyScore: -5,
  });
  assert.equal(result.success, false);
});

test("RegionDescriptorSchema accepts all valid status values", () => {
  for (const status of ["active", "degraded", "disabled"] as const) {
    const result = RegionDescriptorSchema.safeParse({
      regionId: "us-east",
      jurisdiction: "US",
      status,
    });
    assert.equal(result.success, true, `Status "${status}" should be valid`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveRegionFailover Tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveRegionFailover returns no failover when primary is healthy", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover returns no failover when no candidates", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("resolveRegionFailover triggers on unhealthy primary", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover triggers on latency breach", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    primaryLatencyMs: 300,
    maxAcceptableLatencyMs: 200,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover triggers on error rate breach", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover prefers preferredRegionId when valid", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "ap-south",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "ap-south");
});

test("resolveRegionFailover ignores preferredRegionId when not in candidates", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "us-east",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west"); // Falls back to first candidate
});

test("resolveRegionFailover ignores null preferredRegionId", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west"],
    preferredRegionId: null,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
});

test("resolveRegionFailover handles primary healthy with only latency metrics", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    primaryLatencyMs: 50,
    maxAcceptableLatencyMs: 100,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover handles primary healthy with only error rate metrics", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    primaryErrorRate: 0.01,
    maxAcceptableErrorRate: 0.05,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover latency breach takes priority over error rate when both breach", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    primaryLatencyMs: 300,
    maxAcceptableLatencyMs: 200,
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover uses first candidate when preferredRegionId is empty string", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
});

test("resolveRegionFailover handles empty candidateRegionIds with unhealthy primary", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("resolveRegionFailover targetRegionId is null when no failover needed", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, null);
});

test("resolveRegionFailover returns rationale for healthy primary even with latency breach", () => {
  // Even if latency is high, if primary is healthy the rationale should reflect that
  // The function first checks !input.primaryHealthy
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    primaryLatencyMs: 300,
    maxAcceptableLatencyMs: 200,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  // No candidates available, so no failover
  assert.equal(decision.shouldFailover, false);
});
