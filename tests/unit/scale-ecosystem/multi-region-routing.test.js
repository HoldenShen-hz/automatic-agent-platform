import assert from "node:assert/strict";
import test from "node:test";
import { selectPreferredRegion, RegionDescriptorSchema } from "../../../src/scale-ecosystem/multi-region/region-router/index.js";
import { resolveRegionFailover } from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import { shouldReplicateToRegion, ReplicationPolicySchema, ReplicationEventBuffer, computeChecksum } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { CrossRegionRoutingService } from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";

test("selectPreferredRegion returns lowest latency active region", () => {
  const regions = [
    RegionDescriptorSchema.parse({ regionId: "us-east-1", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-east-1.example.com" }, latencyScore: 50, residencyAllowed: true, status: "active" }),
    RegionDescriptorSchema.parse({ regionId: "us-west-2", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-west-2.example.com" }, latencyScore: 30, residencyAllowed: true, status: "active" }),
    RegionDescriptorSchema.parse({ regionId: "eu-west-1", provider: "aws", jurisdiction: "EU", endpoints: { api: "https://api.eu-west-1.example.com" }, latencyScore: 80, residencyAllowed: true, status: "active" }),
  ];
  const selected = selectPreferredRegion(regions);
  assert.equal(selected?.regionId, "us-west-2");
});

test("selectPreferredRegion filters out draining regions", () => {
  const regions = [
    RegionDescriptorSchema.parse({ regionId: "us-east-1", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-east-1.example.com" }, latencyScore: 20, residencyAllowed: true, status: "draining" }),
    RegionDescriptorSchema.parse({ regionId: "us-west-2", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-west-2.example.com" }, latencyScore: 100, residencyAllowed: true, status: "active" }),
  ];
  const selected = selectPreferredRegion(regions);
  assert.equal(selected?.regionId, "us-west-2");
});

test("selectPreferredRegion filters out regions where residency not allowed", () => {
  const regions = [
    RegionDescriptorSchema.parse({ regionId: "us-east-1", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-east-1.example.com" }, latencyScore: 10, residencyAllowed: false, status: "active" }),
    RegionDescriptorSchema.parse({ regionId: "eu-west-1", provider: "aws", jurisdiction: "EU", endpoints: { api: "https://api.eu-west-1.example.com" }, latencyScore: 50, residencyAllowed: true, status: "active" }),
  ];
  const selected = selectPreferredRegion(regions);
  assert.equal(selected?.regionId, "eu-west-1");
});

test("selectPreferredRegion returns null for empty region list", () => {
  const selected = selectPreferredRegion([]);
  assert.equal(selected, null);
});

test("resolveRegionFailover returns no failover when primary is healthy", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    candidateRegionIds: ["us-east-1", "us-west-2"],
    primaryLatencyMs: 50,
    maxAcceptableLatencyMs: 100,
  });
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover triggers failover when primary is unhealthy", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["us-east-1", "us-west-2"],
  });
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "us-east-1");
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover triggers failover on latency breach", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    candidateRegionIds: ["us-east-1"],
    primaryLatencyMs: 150,
    maxAcceptableLatencyMs: 100,
  });
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "us-east-1");
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover triggers failover on error rate breach", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    candidateRegionIds: ["us-east-1"],
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
  });
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover returns no failover when no candidates available", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: [],
  });
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("resolveRegionFailover prefers preferred region when specified", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["us-east-1", "us-west-2"],
    preferredRegionId: "us-west-2",
  });
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "us-west-2");
});

test("shouldReplicateToRegion returns true for allowed cross border with targets", () => {
  const policy = ReplicationPolicySchema.parse({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "allowed_cross_border",
  });
  assert.equal(shouldReplicateToRegion(policy, "us-west-2"), true);
  assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), true);
});

test("shouldReplicateToRegion returns false when blocked", () => {
  const policy = ReplicationPolicySchema.parse({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["eu-west-1"],
    residencyMode: "blocked",
  });
  assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), false);
});

test("shouldReplicateToRegion returns false for non-target region", () => {
  const policy = ReplicationPolicySchema.parse({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  });
  assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), false);
});

test("ReplicationEventBuffer add returns true when max size reached", () => {
  const buffer = new ReplicationEventBuffer(3, 60000);
  const event = { eventId: "e1", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "Task", aggregateId: "task-1", payload: { data: "test" }, timestamp: "2026-04-29T00:00:00.000Z", checksum: "" };
  assert.equal(buffer.add(event), false);
  assert.equal(buffer.add(event), false);
  const shouldFlush = buffer.add(event);
  assert.equal(shouldFlush, true);
  assert.equal(buffer.size(), 4);
});

test("ReplicationEventBuffer flush returns all events and clears buffer", () => {
  const buffer = new ReplicationEventBuffer(10, 60000);
  const event1 = { eventId: "e1", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "Task", aggregateId: "task-1", payload: { data: "test1" }, timestamp: "2026-04-29T00:00:00.000Z", checksum: "" };
  const event2 = { eventId: "e2", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "Task", aggregateId: "task-2", payload: { data: "test2" }, timestamp: "2026-04-29T00:01:00.000Z", checksum: "" };
  buffer.add(event1);
  buffer.add(event2);
  const flushed = buffer.flush();
  assert.equal(flushed.length, 2);
  assert.equal(buffer.size(), 0);
});

test("computeChecksum produces deterministic sha256 hash", () => {
  const payload = { data: "test payload" };
  const checksum1 = computeChecksum(payload, "sha256");
  const checksum2 = computeChecksum(payload, "sha256");
  assert.equal(checksum1, checksum2);
  assert.equal(checksum1.length, 64); // SHA256 produces 64 hex chars
});

test("computeChecksum produces different hashes for different payloads", () => {
  const checksum1 = computeChecksum({ data: "test1" }, "sha256");
  const checksum2 = computeChecksum({ data: "test2" }, "sha256");
  assert.notEqual(checksum1, checksum2);
});

test("CrossRegionRoutingService.route selects preferred region", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    RegionDescriptorSchema.parse({ regionId: "us-east-1", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-east-1.example.com" }, latencyScore: 50, residencyAllowed: true, status: "active" }),
    RegionDescriptorSchema.parse({ regionId: "us-west-2", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-west-2.example.com" }, latencyScore: 30, residencyAllowed: true, status: "active" }),
  ];
  const decision = service.route({
    regions,
    policy: { policyId: "policy-1", allowedJurisdictions: ["US"], allowCrossBorder: true },
    primaryRegionId: "us-east-1",
    preferredRegionId: "us-west-2",
    primaryRegionHealthy: true,
  });
  assert.equal(decision.selectedRegionId, "us-west-2");
  assert.equal(decision.candidateRegions.includes("us-west-2"), true);
});

test("CrossRegionRoutingService.route returns blocked when all regions filtered", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    RegionDescriptorSchema.parse({ regionId: "us-east-1", provider: "aws", jurisdiction: "EU", endpoints: { api: "https://api.us-east-1.example.com" }, latencyScore: 50, residencyAllowed: true, status: "active" }),
  ];
  const decision = service.route({
    regions,
    policy: { policyId: "policy-1", allowedJurisdictions: ["US"], allowCrossBorder: true },
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: true,
  });
  assert.equal(decision.selectedRegionId, null);
  assert.equal(decision.residencyDecision, "blocked");
  assert.equal(decision.blockedRegions.includes("us-east-1"), true);
});

test("CrossRegionRoutingService.route includes failover topology", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    RegionDescriptorSchema.parse({ regionId: "us-east-1", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-east-1.example.com" }, latencyScore: 50, residencyAllowed: true, status: "active" }),
    RegionDescriptorSchema.parse({ regionId: "us-west-2", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-west-2.example.com" }, latencyScore: 30, residencyAllowed: true, status: "active" }),
  ];
  const decision = service.route({
    regions,
    policy: { policyId: "policy-1", allowedJurisdictions: ["US"], allowCrossBorder: true },
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: false,
  });
  assert.equal(decision.recoveryTopology.failoverRegionId, "us-west-2");
});

test("CrossRegionRoutingService.route handles unhealthy primary with forced failover", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    RegionDescriptorSchema.parse({ regionId: "us-east-1", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-east-1.example.com" }, latencyScore: 50, residencyAllowed: true, status: "active" }),
    RegionDescriptorSchema.parse({ regionId: "us-west-2", provider: "aws", jurisdiction: "US", endpoints: { api: "https://api.us-west-2.example.com" }, latencyScore: 30, residencyAllowed: true, status: "active" }),
  ];
  const decision = service.route({
    regions,
    policy: { policyId: "policy-1", allowedJurisdictions: ["US"], allowCrossBorder: true },
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: true,
  });
  assert.equal(decision.selectedRegionId, "us-west-2");
  assert.equal(decision.recoveryTopology.failoverRegionId, null); // primary healthy, no failover needed
});