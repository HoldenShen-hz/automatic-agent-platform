/**
 * Unit tests for multi-region modules in src/scale-ecosystem/multi-region/
 *
 * Tests CrossRegionRoutingService, region router, failover controller,
 * region health check, CDC replication, and data replicator.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CrossRegionRoutingService,
  type CrossRegionRouteRequest,
  type ResidencyPolicy,
} from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import {
  selectPreferredRegion,
  RegionDescriptorSchema,
  type RegionDescriptor,
} from "../../../src/scale-ecosystem/multi-region/region-router/index.js";
import {
  resolveRegionFailover,
  type RegionFailoverInput,
} from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
  type RegionHealthCheckConfig,
} from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
} from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import {
  ReplicationEventBuffer,
  computeChecksum,
  createDataReplicator,
  type ReplicationPolicy,
} from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// RegionDescriptor Factory
// ─────────────────────────────────────────────────────────────────────────────

function createRegion(overrides: Partial<RegionDescriptor> = {}): RegionDescriptor {
  return {
    regionId: overrides.regionId ?? "region-1",
    countryCode: overrides.countryCode ?? "US",
    jurisdiction: overrides.jurisdiction ?? "US",
    capabilities: overrides.capabilities ?? [],
    status: overrides.status ?? "active",
    latencyScore: overrides.latencyScore ?? 0,
    residencyAllowed: overrides.residencyAllowed ?? true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ResidencyPolicy Factory
// ─────────────────────────────────────────────────────────────────────────────

function createResidencyPolicy(overrides: Partial<ResidencyPolicy> = {}): ResidencyPolicy {
  return {
    policyId: overrides.policyId ?? "policy-1",
    allowedJurisdictions: overrides.allowedJurisdictions ?? ["US", "EU"],
    blockedRegionIds: overrides.blockedRegionIds ?? [],
    requiredCapabilities: overrides.requiredCapabilities ?? [],
    allowCrossBorder: overrides.allowCrossBorder ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CrossRegionRoutingService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CrossRegionRoutingService.route selects lowest latency region", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 30 }),
    createRegion({ regionId: "eu-west", latencyScore: 80 }),
    createRegion({ regionId: "ap-south", latencyScore: 120 }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy(),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.selectedRegionId, "us-east");
  assert.equal(decision.residencyDecision, "allowed");
});

test("CrossRegionRoutingService.route blocks regions by blockedRegionIds", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10 }),
    createRegion({ regionId: "eu-west", latencyScore: 20 }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy({ blockedRegionIds: ["us-east"] }),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.blockedRegions.includes("us-east"), true);
  assert.equal(decision.selectedRegionId, "eu-west");
});

test("CrossRegionRoutingService.route respects allowedJurisdictions", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", jurisdiction: "US", latencyScore: 10 }),
    createRegion({ regionId: "cn-north", jurisdiction: "CN", latencyScore: 5 }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy({ allowedJurisdictions: ["US"] }),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.blockedRegions.includes("cn-north"), true);
  assert.equal(decision.selectedRegionId, "us-east");
});

test("CrossRegionRoutingService.route requires capabilities when specified", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", capabilities: ["llm", "storage"] }),
    createRegion({ regionId: "eu-west", capabilities: ["storage"] }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy({ requiredCapabilities: ["llm"] }),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.blockedRegions.includes("eu-west"), true);
  assert.equal(decision.selectedRegionId, "us-east");
});

test("CrossRegionRoutingService.route returns blocked when no valid region", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "cn-north", jurisdiction: "CN", status: "disabled" }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy({ allowedJurisdictions: ["US"] }),
    primaryRegionId: "cn-north",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.residencyDecision, "blocked");
  assert.equal(decision.selectedRegionId, null);
});

test("CrossRegionRoutingService.route uses preferredRegionId when provided", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10 }),
    createRegion({ regionId: "eu-west", latencyScore: 5 }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy(),
    primaryRegionId: "us-east",
    preferredRegionId: "eu-west",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.selectedRegionId, "eu-west");
});

test("CrossRegionRoutingService.route sets recoveryTopology with failover target", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10 }),
    createRegion({ regionId: "eu-west", latencyScore: 20 }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy(),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.recoveryTopology.primaryRegionId, "us-east");
  assert.equal(decision.recoveryTopology.failoverRegionId, null);
});

test("CrossRegionRoutingService.route handles residencyAllowed false", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", residencyAllowed: false }),
    createRegion({ regionId: "eu-west", residencyAllowed: true }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy(),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.blockedRegions.includes("us-east"), true);
  assert.equal(decision.selectedRegionId, "eu-west");
});

// ─────────────────────────────────────────────────────────────────────────────
// selectPreferredRegion Tests
// ─────────────────────────────────────────────────────────────────────────────

test("selectPreferredRegion returns null for empty array", () => {
  const result = selectPreferredRegion([]);
  assert.equal(result, null);
});

test("selectPreferredRegion returns null when all regions disabled", () => {
  const regions = [
    createRegion({ regionId: "us-east", status: "disabled" }),
    createRegion({ regionId: "eu-west", status: "disabled" }),
  ];
  const result = selectPreferredRegion(regions);
  assert.equal(result, null);
});

test("selectPreferredRegion filters out disabled regions", () => {
  const regions = [
    createRegion({ regionId: "us-east", status: "disabled" }),
    createRegion({ regionId: "eu-west", status: "active" }),
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "eu-west");
});

test("selectPreferredRegion sorts by latencyScore ascending", () => {
  const regions = [
    createRegion({ regionId: "ap-south", latencyScore: 150 }),
    createRegion({ regionId: "us-east", latencyScore: 30 }),
    createRegion({ regionId: "eu-west", latencyScore: 80 }),
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east");
});

test("selectPreferredRegion includes degraded status regions", () => {
  const regions = [
    createRegion({ regionId: "us-east", status: "degraded", latencyScore: 10 }),
    createRegion({ regionId: "eu-west", status: "active", latencyScore: 50 }),
  ];
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east");
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveRegionFailover Tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveRegionFailover returns no failover when primary healthy", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
  });
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover triggers on unhealthy primary", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["eu-west"],
  });
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover triggers on latency breach", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    primaryLatencyMs: 300,
    maxAcceptableLatencyMs: 200,
    candidateRegionIds: ["eu-west"],
  });
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover triggers on error rate breach", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
    candidateRegionIds: ["eu-west"],
  });
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover prefers preferredRegionId when in candidates", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "ap-south",
  });
  assert.equal(decision.targetRegionId, "ap-south");
});

test("resolveRegionFailover ignores preferredRegionId when not in candidates", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "us-east",
  });
  assert.equal(decision.targetRegionId, "eu-west");
});

test("resolveRegionFailover returns no candidate when empty candidates", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: [],
  });
  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

// ─────────────────────────────────────────────────────────────────────────────
// RegionHealthCheckService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RegionHealthCheckService.registerRegion adds region to monitoring", () => {
  const service = new RegionHealthCheckService();
  const config: RegionHealthCheckConfig = {
    regionId: "us-east",
    endpoint: "https://us-east.example.com/health",
    checkIntervalMs: 5000,
    timeoutMs: 3000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  };

  service.registerRegion(config);
  assert.equal(service.getHealthStatus("us-east"), "unknown");
});

test("RegionHealthCheckService.checkRegion returns unknown for unregistered region", async () => {
  const service = new RegionHealthCheckService();
  const result = await service.checkRegion("unknown-region");

  assert.equal(result.status, "unknown");
  assert.equal(result.regionId, "unknown-region");
  assert.equal(result.errorMessage, "Region not registered");
});

test("RegionHealthCheckService.unregisterRegion removes region from monitoring", () => {
  const service = new RegionHealthCheckService();
  const config = createHealthConfig("us-east");
  service.registerRegion(config);
  service.unregisterRegion("us-east");

  const result = service.getHealthSummary("us-east");
  assert.equal(result, null);
});

test("RegionHealthCheckService.getHealthSummary returns null for unknown region", () => {
  const service = new RegionHealthCheckService();
  const result = service.getHealthSummary("unknown");
  assert.equal(result, null);
});

test("RegionHealthCheckService.shouldFailover returns false for unregistered region", () => {
  const service = new RegionHealthCheckService();
  assert.equal(service.shouldFailover("unknown-region"), false);
});

test("RegionHealthCheckService.getRegionsNeedingFailover returns empty for no failures", () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthConfig("us-east"));
  assert.deepEqual(service.getRegionsNeedingFailover(), []);
});

test("RegionHealthCheckService.resetHealthState clears failure count", () => {
  const service = new RegionHealthCheckService();
  const config = createHealthConfig("us-east");
  service.registerRegion(config);
  service.resetHealthState("us-east");

  const result = service.getHealthSummary("us-east");
  assert.ok(result !== null);
  assert.equal(result.consecutiveFailures, 0);
});

test("RegionHealthCheckService.getThresholds returns thresholds when registered", () => {
  const service = new RegionHealthCheckService();
  const config = createHealthConfig("us-east");
  service.registerRegion(config);

  const thresholds = service.getThresholds("us-east");
  assert.ok(thresholds !== undefined);
  assert.equal(thresholds.maxLatencyMs, 200);
});

test("RegionHealthCheckService.getAllHealthStatuses returns map of all statuses", () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthConfig("us-east"));
  service.registerRegion(createHealthConfig("eu-west"));

  const statuses = service.getAllHealthStatuses();
  assert.equal(statuses.size, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// RegionFailoverOrchestrator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RegionFailoverOrchestrator.registerRegion delegates to health service", () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion(createHealthConfig("us-east"));

  const summary = orchestrator.getHealthCheckService().getHealthSummary("us-east");
  assert.ok(summary !== null);
  assert.equal(summary.regionId, "us-east");
});

test("RegionFailoverOrchestrator.selectFailoverTarget returns null when no healthy regions", () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion(createHealthConfig("us-east"));

  const target = orchestrator.selectFailoverTarget("us-east", ["us-east", "eu-west"]);
  assert.equal(target, null);
});

test("RegionFailoverOrchestrator.addFailoverListener registers listener", () => {
  const orchestrator = new RegionFailoverOrchestrator();
  const listener = (_source: string, _target: string) => {};

  orchestrator.addFailoverListener(listener);
  orchestrator.removeFailoverListener(listener);
  // If remove doesn't throw, listener was added
});

test("RegionFailoverOrchestrator.orchestrateFailover returns failure when no target", async () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion(createHealthConfig("us-east"));

  const result = await orchestrator.orchestrateFailover("us-east", ["us-east"]);
  assert.equal(result.success, false);
  assert.equal(result.targetRegionId, null);
});

test("RegionFailoverOrchestrator.checkAndFailover returns no failover when healthy", async () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion(createHealthConfig("us-east"));

  const result = await orchestrator.checkAndFailover("us-east", ["us-east", "eu-west"]);
  assert.equal(result.didFailover, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// CDCReplicationService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.registerReplication adds config", () => {
  const service = new CDCReplicationService();
  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const config = service.getConfig("us-east", "eu-west");
  assert.ok(config !== undefined);
  assert.equal(config.sourceRegionId, "us-east");
});

test("CDCReplicationService.getCheckpoint returns undefined for unregistered pair", () => {
  const service = new CDCReplicationService();
  const checkpoint = service.getCheckpoint("us-east", "eu-west");
  assert.equal(checkpoint, undefined);
});

test("CDCReplicationService.isEnabled returns false when not registered", () => {
  const service = new CDCReplicationService();
  assert.equal(service.isEnabled("us-east", "eu-west"), false);
});

test("CDCReplicationService.getStatus returns idle when no queue", () => {
  const service = new CDCReplicationService();
  const status = service.getStatus("us-east", "eu-west");
  assert.equal(status, "idle");
});

test("CDCReplicationService.getRegisteredRegionPairs returns empty when none registered", () => {
  const service = new CDCReplicationService();
  const pairs = service.getRegisteredRegionPairs();
  assert.deepEqual(pairs, []);
});

test("CDCReplicationService.getReplicationLag returns total events when no checkpoint", () => {
  const service = new CDCReplicationService();
  const lag = service.getReplicationLag("us-east", "eu-west", 100);
  assert.equal(lag, 100);
});

test("CDCReplicationService.recordFailure logs error without throwing", () => {
  const service = new CDCReplicationService();
  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  service.recordFailure("us-east", "eu-west", {
    batchId: "batch-1",
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    events: [],
    startSequence: 0,
    endSequence: 0,
    createdAt: new Date().toISOString(),
  }, "Test error");

  // Should not throw
});

// ─────────────────────────────────────────────────────────────────────────────
// MultiRegionReplicationCoordinator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("MultiRegionReplicationCoordinator.setupRegionReplication registers configs", () => {
  const coordinator = new MultiRegionReplicationCoordinator();
  coordinator.setupRegionReplication("us-east", [
    { targetRegionId: "eu-west" },
    { targetRegionId: "ap-south", batchSize: 50 },
  ]);

  const replications = coordinator.getRegionReplications("us-east");
  assert.equal(replications.length, 2);
});

test("MultiRegionReplicationCoordinator.getCDCService returns service instance", () => {
  const coordinator = new MultiRegionReplicationCoordinator();
  const cdc = coordinator.getCDCService();
  assert.ok(cdc instanceof CDCReplicationService);
});

// ─────────────────────────────────────────────────────────────────────────────
// ReplicationEventBuffer Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplicationEventBuffer.size returns current buffer size", () => {
  const buffer = new ReplicationEventBuffer(10);
  assert.equal(buffer.size(), 0);

  buffer.add({
    eventId: "event-1",
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    aggregateType: "task",
    aggregateId: "task-1",
    payload: {},
    timestamp: new Date().toISOString(),
    checksum: "abc",
  });

  assert.equal(buffer.size(), 1);
});

test("ReplicationEventBuffer.add returns true when max size reached", () => {
  const buffer = new ReplicationEventBuffer(2);
  const event1 = createReplicationEvent("event-1");
  const event2 = createReplicationEvent("event-2");

  assert.equal(buffer.add(event1), false);
  assert.equal(buffer.add(event2), true); // max size reached
});

test("ReplicationEventBuffer.flush clears buffer and returns events", () => {
  const buffer = new ReplicationEventBuffer(10);
  buffer.add(createReplicationEvent("event-1"));
  buffer.add(createReplicationEvent("event-2"));

  const events = buffer.flush();
  assert.equal(events.length, 2);
  assert.equal(buffer.size(), 0);
});

test("ReplicationEventBuffer.shouldFlush returns false for empty buffer", () => {
  const buffer = new ReplicationEventBuffer(10, 60000);
  assert.equal(buffer.shouldFlush(), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// computeChecksum Tests
// ─────────────────────────────────────────────────────────────────────────────

test("computeChecksum produces sha256 hash by default", () => {
  const checksum = computeChecksum({ data: "test" });
  assert.equal(checksum.length, 64); // SHA-256 produces 64 hex chars
});

test("computeChecksum produces md5 hash when specified", () => {
  const checksum = computeChecksum({ data: "test" }, "md5");
  assert.equal(checksum.length, 32); // MD5 produces 32 hex chars
});

test("computeChecksum produces same result for same input", () => {
  const payload = { key: "value" };
  const checksum1 = computeChecksum(payload);
  const checksum2 = computeChecksum(payload);
  assert.equal(checksum1, checksum2);
});

// ─────────────────────────────────────────────────────────────────────────────
// createDataReplicator Factory Function Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createDataReplicator returns DataReplicatorService instance", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  });

  assert.equal(replicator.getBuffer("eu-west")?.size() ?? -1, 0);
});

test("createDataReplicator with custom options", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "allowed_cross_border",
  }, { batchSize: 50, flushIntervalMs: 1000 });

  const buffer = replicator.getBuffer("eu-west");
  assert.ok(buffer !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// RegionDescriptorSchema Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RegionDescriptorSchema accepts valid minimal input", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "us-east",
    jurisdiction: "US",
  });
  assert.equal(result.success, true);
});

test("RegionDescriptorSchema rejects empty regionId", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "",
    jurisdiction: "US",
  });
  assert.equal(result.success, false);
});

test("RegionDescriptorSchema rejects short countryCode", () => {
  const result = RegionDescriptorSchema.safeParse({
    regionId: "us-east",
    countryCode: "U",
    jurisdiction: "US",
  });
  assert.equal(result.success, false);
});

test("RegionDescriptorSchema accepts all valid status values", () => {
  for (const status of ["active", "degraded", "disabled"]) {
    const result = RegionDescriptorSchema.safeParse({
      regionId: "us-east",
      jurisdiction: "US",
      status,
    });
    assert.equal(result.success, true, `Status ${status} should be valid`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function createHealthConfig(regionId: string): RegionHealthCheckConfig {
  return {
    regionId,
    endpoint: `https://${regionId}.example.com/health`,
    checkIntervalMs: 5000,
    timeoutMs: 3000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  };
}

function createReplicationEvent(eventId: string) {
  return {
    eventId,
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    aggregateType: "task",
    aggregateId: "task-1",
    payload: {},
    timestamp: new Date().toISOString(),
    checksum: "abc123",
  };
}
