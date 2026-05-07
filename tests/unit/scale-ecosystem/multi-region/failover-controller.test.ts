import assert from "node:assert/strict";
import test from "node:test";

import { resolveRegionFailover, type RegionFailoverInput } from "../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

test("resolveRegionFailover returns no failover when primary is healthy", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west", "ap-south"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover returns failover when primary is unhealthy", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover returns no failover when no candidates", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
});

test("resolveRegionFailover selects preferred region when available", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "ap-south",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "ap-south");
});

test("resolveRegionFailover ignores preferred region when not in candidates", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "us-east",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
});

test("resolveRegionFailover triggers failover on latency breach", () => {
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

test("resolveRegionFailover triggers failover on error rate breach", () => {
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

test("resolveRegionFailover falls back deterministically when candidates have no extra signals", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-a");
});

test("resolveRegionFailover prefers healthy lower-latency candidate when signals are provided", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b"],
    candidateRegionSignals: {
      "region-a": { healthy: true, latencyMs: 400, errorRate: 0.02 },
      "region-b": { healthy: true, latencyMs: 80, errorRate: 0.01 },
    },
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-b");
});

test("resolveRegionFailover handles degraded primary", () => {
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

test("resolveRegionFailover returns rationale for healthy primary with no breach", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover handles null latency and error inputs", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover handles partial threshold inputs - only latency", () => {
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

test("resolveRegionFailover handles partial threshold inputs - only error rate", () => {
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

test("resolveRegionFailover handles exact threshold boundary for latency", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 100,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover handles exact threshold boundary for error rate", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0.01,
    maxAcceptableErrorRate: 0.01,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover prefers preferredRegionId over first candidate when both valid", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
    preferredRegionId: "region-b",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-b");
});

test("resolveRegionFailover prefers preferredRegionId when only one candidate", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a"],
    preferredRegionId: "region-a",
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-a");
});

test("resolveRegionFailover handles zero latency as valid", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryLatencyMs: 0,
    maxAcceptableLatencyMs: 100,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover handles zero error rate as valid", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
    primaryErrorRate: 0,
    maxAcceptableErrorRate: 0.01,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover empty candidates with healthy primary returns no failover", () => {
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

test("resolveRegionFailover empty candidates with unhealthy primary returns no failover", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("resolveRegionFailover returns correct rationale for latency breach vs error rate breach", () => {
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

test("resolveRegionFailover with only error rate breach returns error rate rationale", () => {
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

test("resolveRegionFailover with only latency breach returns latency rationale", () => {
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

test("resolveRegionFailover multiple breaches prioritizes unhealthy primary rationale", () => {
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

test("resolveRegionFailover preferredRegionId is null does not select preferred", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: null,
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west"); // Falls back to first candidate
});

test("resolveRegionFailover result structure is correct", () => {
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
