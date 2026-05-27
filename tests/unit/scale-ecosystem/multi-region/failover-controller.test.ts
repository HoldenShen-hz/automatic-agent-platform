import assert from "node:assert/strict";
import test from "node:test";

import { resolveRegionFailover, type RegionFailoverInput } from "../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

test("resolveRegionFailover returns no failover when primary is healthy [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west", "ap-south"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover returns failover when primary is unhealthy [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover returns no failover when no candidates [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
});

test("resolveRegionFailover selects preferred region when available [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "ap-south",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "ap-south");
});

test("resolveRegionFailover ignores preferred region when not in candidates [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "us-east",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west"); // First candidate
});

test("resolveRegionFailover triggers failover on latency breach [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 150,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover triggers failover on error rate breach [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0.06,
    maxAcceptableErrorRate: 0.01,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover uses first candidate when preferred not available [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-a");
});

test("resolveRegionFailover handles degraded primary [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a"],
    primaryLatencyMs: 200,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover returns rationale for healthy primary with no breach [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover handles null latency and error inputs [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover handles partial threshold inputs - only latency [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 50,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover handles partial threshold inputs - only error rate [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0.005,
    maxAcceptableErrorRate: 0.01,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover handles exact threshold boundary for latency [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 100,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover handles exact threshold boundary for error rate [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0.01,
    maxAcceptableErrorRate: 0.01,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover prefers preferredRegionId over first candidate when both valid [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
    preferredRegionId: "region-b",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-b");
});

test("resolveRegionFailover prefers preferredRegionId when only one candidate [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a"],
    preferredRegionId: "region-a",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-a");
});

test("resolveRegionFailover handles zero latency as valid [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 0,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover handles zero error rate as valid [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0,
    maxAcceptableErrorRate: 0.01,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover empty candidates with healthy primary returns no failover [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: [],
    primaryLatencyMs: 200,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("resolveRegionFailover empty candidates with unhealthy primary returns no failover [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("resolveRegionFailover returns correct rationale for latency breach vs error rate breach [failover-controller]", () => {
  const input1: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 150,
    maxAcceptableLatencyMs: 100,
  };
  const decision1 = resolveRegionFailover(input1);
  assert.equal(decision1.rationale, "multi_region.primary_latency_breached");

  const input2: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0.05,
    maxAcceptableErrorRate: 0.01,
  };
  const decision2 = resolveRegionFailover(input2);
  assert.equal(decision2.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover with only error rate breach returns error rate rationale [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0.99,
    maxAcceptableErrorRate: 0.5,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover with only latency breach returns latency rationale [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 999,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover multiple breaches prioritizes unhealthy primary rationale [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 999,
    maxAcceptableLatencyMs: 100,
    primaryErrorRate: 0.99,
    maxAcceptableErrorRate: 0.5,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover preferredRegionId is null does not select preferred [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: null,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west"); // Falls back to first candidate
});

test("resolveRegionFailover result structure is correct [failover-controller]", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.ok("shouldFailover" in decision);
  assert.ok("targetRegionId" in decision);
  assert.ok("rationale" in decision);
  assert.equal(typeof decision.shouldFailover, "boolean");
  assert.equal(typeof decision.targetRegionId, "string");
  assert.equal(typeof decision.rationale, "string");
});