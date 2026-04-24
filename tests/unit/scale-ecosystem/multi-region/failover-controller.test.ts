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
  assert.equal(decision.targetRegionId, "eu-west"); // First candidate
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

test("resolveRegionFailover uses first candidate when preferred not available", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
  };
  const decision = resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-a");
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
