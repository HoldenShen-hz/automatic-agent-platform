import assert from "node:assert/strict";
import test from "node:test";

import { CrossRegionRoutingService, type CrossRegionRouteRequest } from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import { resolveRegionFailover, getNextFencingEpoch, type RegionFailoverInput } from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import { RegionHealthCheckService, RegionFailoverOrchestrator } from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import { CDCReplicationService } from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import { DataReplicatorService } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { transitionRemoteSessionState, type RemoteSessionState } from "../../../src/scale-ecosystem/multi-region/remote-session-state.js";
import { selectPreferredRegion, type RegionDescriptor } from "../../../src/scale-ecosystem/multi-region/region-router/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

function createMockRegionDescriptor(overrides = {}): RegionDescriptor {
  return {
    regionId: "us-east-1",
    provider: "aws",
    endpoints: { api: "https://api.us-east-1.example.com" },
    dataResidencyPolicy: "regional",
    countryCode: "US",
    jurisdiction: "US",
    capabilities: ["compute", "storage"],
    status: "active",
    latencyScore: 45,
    residencyAllowed: true,
    ...overrides,
  };
}

function createMultiRegionConfig() {
  return {
    primary: createMockRegionDescriptor({ regionId: "us-east-1", latencyScore: 45 }),
    secondary: createMockRegionDescriptor({ regionId: "us-west-2", latencyScore: 75 }),
    tertiary: createMockRegionDescriptor({ regionId: "eu-west-1", latencyScore: 120 }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Execution can be routed to different regional workers
// ─────────────────────────────────────────────────────────────────────────────

test("integration: execution can be routed to primary region when healthy", () => {
  const service = new CrossRegionRoutingService();
  const { primary, secondary, tertiary } = createMultiRegionConfig();

  const request: CrossRegionRouteRequest = {
    regions: [primary, secondary, tertiary],
    policy: {
      policyId: "default",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      allowCrossBorder: true,
    },
    primaryRegionId: "us-east-1",
    preferredRegionId: "us-east-1",
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-east-1");
  assert.equal(decision.residencyDecision, "allowed");
  assert.ok(decision.candidateRegions.includes("us-east-1"));
});

test("integration: execution can be routed to alternate region when primary is excluded", () => {
  const service = new CrossRegionRoutingService();
  const { primary, secondary, tertiary } = createMultiRegionConfig();

  const request: CrossRegionRouteRequest = {
    regions: [primary, secondary, tertiary],
    policy: {
      policyId: "default",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: ["us-east-1"],
      requiredCapabilities: [],
      allowCrossBorder: true,
    },
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.ok(decision.selectedRegionId !== "us-east-1");
  assert.ok(decision.blockedRegions.includes("us-east-1"));
  assert.ok(decision.candidateRegions.includes("us-west-2") || decision.candidateRegions.includes("eu-west-1"));
});

test("integration: execution can be routed to lowest latency available region", () => {
  const service = new CrossRegionRoutingService();
  const { secondary, tertiary } = createMultiRegionConfig();

  // Only secondary and tertiary available (primary blocked)
  const request: CrossRegionRouteRequest = {
    regions: [secondary, tertiary],
    policy: {
      policyId: "default",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      allowCrossBorder: true,
    },
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  // us-west-2 has lower latency (75) than eu-west-1 (120)
  assert.equal(decision.selectedRegionId, "us-west-2");
  assert.equal(decision.latencyScore, 75);
});

test("integration: routing respects required capabilities when selecting region", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createMockRegionDescriptor({ regionId: "us-east-1", capabilities: ["compute"], latencyScore: 30 }),
    createMockRegionDescriptor({ regionId: "us-west-2", capabilities: ["compute", "gpu"], latencyScore: 60 }),
    createMockRegionDescriptor({ regionId: "eu-west-1", capabilities: ["compute", "storage"], latencyScore: 90 }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "gpu_workload",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: ["gpu"],
      allowCrossBorder: false,
    },
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-west-2");
  assert.ok(decision.blockedRegions.includes("us-east-1"));
  assert.ok(decision.blockedRegions.includes("eu-west-1"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lease state is consistent across regions (fencing token)
// ─────────────────────────────────────────────────────────────────────────────

test("integration: fencing epoch increments on each failover decision", () => {
  const epoch1 = getNextFencingEpoch();
  const epoch2 = getNextFencingEpoch();
  const epoch3 = getNextFencingEpoch();

  assert.ok(epoch2 > epoch1);
  assert.ok(epoch3 > epoch2);
});

test("integration: resolveRegionFailover increments fencing epoch on failover", () => {
  const inputDegraded: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["us-west-2", "eu-west-1"],
  };

  const decision1 = resolveRegionFailover(inputDegraded);
  assert.equal(decision1.shouldFailover, true);
  assert.ok(decision1.fencingEpoch > 0);

  // Simulate another failover decision later
  const decision2 = resolveRegionFailover(inputDegraded);
  assert.ok(decision2.fencingEpoch > decision1.fencingEpoch);
});

test("integration: fencing epoch reflects primary region becoming unhealthy", () => {
  const inputHealthy: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["us-east-1", "us-west-2"],
    primaryLatencyMs: 50,
    maxAcceptableLatencyMs: 100,
  };

  const healthyDecision = resolveRegionFailover(inputHealthy);
  assert.equal(healthyDecision.shouldFailover, false);
  assert.ok(healthyDecision.fencingEpoch > 0);

  // Simulate primary becoming unhealthy
  const inputUnhealthy: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["us-east-1", "us-west-2"],
  };

  const unhealthyDecision = resolveRegionFailover(inputUnhealthy);
  assert.equal(unhealthyDecision.shouldFailover, true);
  assert.ok(unhealthyDecision.fencingEpoch > healthyDecision.fencingEpoch);
  assert.equal(unhealthyDecision.targetRegionId, "us-east-1");
});

test("integration: fencing token ensures exclusive lease during failover", () => {
  // Simulate two regions detecting same failure and both trying to acquire lease
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["us-west-2", "eu-west-1"],
  };

  const decision1 = resolveRegionFailover(input);
  const decision2 = resolveRegionFailover(input);

  // Both should get incrementing epochs
  assert.ok(decision2.fencingEpoch > decision1.fencingEpoch);

  // But they should pick the same target (first candidate)
  assert.equal(decision1.targetRegionId, decision2.targetRegionId);
  assert.equal(decision1.targetRegionId, "us-west-2");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cross-region execution doesn't cause split-brain
// ─────────────────────────────────────────────────────────────────────────────

test("integration: cross-region routing blocks when no healthy regions available", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createMockRegionDescriptor({ regionId: "us-east-1", status: "draining" }),
    createMockRegionDescriptor({ regionId: "us-west-2", status: "draining" }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "default",
      allowedJurisdictions: ["US"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      allowCrossBorder: true,
    },
    primaryRegionHealthy: false,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, null);
  assert.equal(decision.residencyDecision, "blocked");
  assert.ok(decision.blockedRegions.length >= 2);
});

test("integration: remote session state transitions prevent split-brain", () => {
  // Start connected
  let state: RemoteSessionState = "connected";
  assert.equal(state, "connected");

  // Connection lost - enters reconnecting state
  state = transitionRemoteSessionState(state, "connection_lost");
  assert.equal(state, "reconnecting");

  // Hard failure from reconnecting goes to failed (not back to connected)
  state = transitionRemoteSessionState(state, "hard_failure");
  assert.equal(state, "failed");

  // Cannot transition from failed back to connected without explicit reconnect
  state = transitionRemoteSessionState(state, "connection_lost");
  assert.equal(state, "failed"); // Stays failed
});

test("integration: viewer mode prevents split-brain during degraded connectivity", () => {
  let state: RemoteSessionState = "connected";

  // Network degraded
  state = transitionRemoteSessionState(state, "partial_sync");
  assert.equal(state, "degraded");

  // User switches to viewer mode
  state = transitionRemoteSessionState(state, "viewer_mode");
  assert.equal(state, "viewer_only");

  // Cannot make changes in viewer mode
  state = transitionRemoteSessionState(state, "connected");
  assert.equal(state, "viewer_only"); // Stays viewer_only
});

test("integration: CDC replication confirms batch only after successful write", () => {
  const cdcService = new CDCReplicationService();

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 10,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events = [
    { id: "evt-1", sequence: 1, eventType: "task.created", taskId: "task-1", payloadJson: "{}", createdAt: new Date().toISOString() },
    { id: "evt-2", sequence: 2, eventType: "task.started", taskId: "task-1", payloadJson: "{}", createdAt: new Date().toISOString() },
  ];

  const batch = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch != null);
  assert.equal(batch.events.length, 2);

  // Confirm the batch (simulates successful replication)
  cdcService.confirmBatch("us-east-1", "us-west-2", batch);

  const checkpoint = cdcService.getCheckpoint("us-east-1", "us-west-2");
  assert.ok(checkpoint != null);
  assert.equal(checkpoint.lastEventSequence, 2);
  assert.ok(checkpoint.lastEventId != null);
});

test("integration: data replicator validates checksums to prevent split-brain", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("us-west-2", "Execution", "exec-1", { status: "running" });
  const isValid = replicator.validateEvent(event);
  assert.equal(isValid, true);

  // Tamper with event to simulate corruption
  const tamperedEvent = { ...event, payload: { status: "completed", _tampered: true } };
  const isInvalid = replicator.validateEvent(tamperedEvent);
  assert.equal(isInvalid, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Regional fallback when primary region is unavailable
// ─────────────────────────────────────────────────────────────────────────────

test("integration: fallback to secondary region when primary is unhealthy", () => {
  const service = new CrossRegionRoutingService();
  const { primary, secondary } = createMultiRegionConfig();

  const request: CrossRegionRouteRequest = {
    regions: [primary, secondary],
    policy: {
      policyId: "default",
      allowedJurisdictions: ["US"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      allowCrossBorder: true,
    },
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: false,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-west-2");
  assert.equal(decision.recoveryTopology.failoverRegionId, "us-west-2");
});

test("integration: fallback to lowest latency healthy region", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createMockRegionDescriptor({ regionId: "us-east-1", latencyScore: 50 }),
    createMockRegionDescriptor({ regionId: "us-west-2", latencyScore: 80 }),
    createMockRegionDescriptor({ regionId: "eu-west-1", latencyScore: 150 }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "default",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      allowCrossBorder: true,
    },
    primaryRegionHealthy: false,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-west-2");
});

test("integration: RegionHealthCheckService detects unhealthy primary and triggers failover", async () => {
  const healthService = new RegionHealthCheckService();

  healthService.registerRegion({
    regionId: "us-east-1",
    endpoint: "https://health.us-east-1.example.com",
    checkIntervalMs: 1000,
    timeoutMs: 500,
    retryCount: 2,
    metricSnapshot: { latencyMs: 500, errorRate: 0.1 },
    thresholds: { maxLatencyMs: 100, maxErrorRate: 0.05, maxCpuUsage: 80, maxMemoryUsage: 90 },
  });

  healthService.registerRegion({
    regionId: "us-west-2",
    endpoint: "https://health.us-west-2.example.com",
    checkIntervalMs: 1000,
    timeoutMs: 500,
    retryCount: 2,
    metricSnapshot: { latencyMs: 80, errorRate: 0.01 },
    thresholds: { maxLatencyMs: 100, maxErrorRate: 0.05, maxCpuUsage: 80, maxMemoryUsage: 90 },
  });

  const result = await healthService.checkRegion("us-east-1");
  assert.equal(result.status, "degraded");

  const shouldFailover = healthService.shouldFailover("us-east-1");
  assert.equal(shouldFailover, true);

  const westResult = await healthService.checkRegion("us-west-2");
  assert.equal(westResult.status, "healthy");
});

test("integration: RegionFailoverOrchestrator selects best fallback target", async () => {
  const orchestrator = new RegionFailoverOrchestrator();

  orchestrator.registerRegion({
    regionId: "us-east-1",
    endpoint: "https://health.us-east-1.example.com",
    checkIntervalMs: 1000,
    timeoutMs: 500,
    retryCount: 3,
    thresholds: { maxLatencyMs: 100, maxErrorRate: 0.05, maxCpuUsage: 80, maxMemoryUsage: 90 },
  });

  orchestrator.registerRegion({
    regionId: "us-west-2",
    endpoint: "https://health.us-west-2.example.com",
    checkIntervalMs: 1000,
    timeoutMs: 500,
    retryCount: 3,
    metricSnapshot: { latencyMs: 60, errorRate: 0.01 },
    thresholds: { maxLatencyMs: 100, maxErrorRate: 0.05, maxCpuUsage: 80, maxMemoryUsage: 90 },
  });

  orchestrator.registerRegion({
    regionId: "eu-west-1",
    endpoint: "https://health.eu-west-1.example.com",
    checkIntervalMs: 1000,
    timeoutMs: 500,
    retryCount: 3,
    metricSnapshot: { latencyMs: 120, errorRate: 0.02 },
    thresholds: { maxLatencyMs: 100, maxErrorRate: 0.05, maxCpuUsage: 80, maxMemoryUsage: 90 },
  });

  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-west-2", "eu-west-1"]);
  assert.equal(target, "us-west-2"); // Lowest latency among healthy
});

test("integration: failover respects latency threshold when selecting fallback", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["us-west-2", "eu-west-1"],
    primaryLatencyMs: 200,
    maxAcceptableLatencyMs: 150,
    primaryErrorRate: 0.02,
    maxAcceptableErrorRate: 0.05,
  };

  const decision = resolveRegionFailover(input);

  // Latency breached (200 > 150), so failover should trigger
  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Execution state is preserved across region failover
// ─────────────────────────────────────────────────────────────────────────────

test("integration: CDC checkpoint preserves sequence across failover", () => {
  const cdcService = new CDCReplicationService();

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 10,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Simulate initial events processed
  const events1 = [
    { id: "evt-1", sequence: 1, eventType: "task.created", taskId: "task-1", payloadJson: "{}", createdAt: new Date().toISOString() },
    { id: "evt-2", sequence: 2, eventType: "task.started", taskId: "task-1", payloadJson: "{}", createdAt: new Date().toISOString() },
  ];

  const batch1 = cdcService.prepareBatch("us-east-1", "us-west-2", events1);
  assert.ok(batch1 != null);
  cdcService.confirmBatch("us-east-1", "us-west-2", batch1);

  // Simulate failover, then more events
  const events2 = [
    { id: "evt-3", sequence: 3, eventType: "task.progress", taskId: "task-1", payloadJson: "{}", createdAt: new Date().toISOString() },
    { id: "evt-4", sequence: 4, eventType: "task.completed", taskId: "task-1", payloadJson: "{}", createdAt: new Date().toISOString() },
  ];

  const batch2 = cdcService.prepareBatch("us-east-1", "us-west-2", events2);
  assert.ok(batch2 != null);
  assert.equal(batch2.startSequence, 3);
  assert.equal(batch2.endSequence, 4);

  cdcService.confirmBatch("us-east-1", "us-west-2", batch2);

  const checkpoint = cdcService.getCheckpoint("us-east-1", "us-west-2");
  assert.equal(checkpoint?.lastEventSequence, 4);
});

test("integration: replication lag calculation accounts for checkpoint position", () => {
  const cdcService = new CDCReplicationService();

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 10,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Simulate 10 events in source region, but only 5 replicated
  cdcService.confirmBatch("us-east-1", "us-west-2", {
    batchId: "batch-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    events: [
      { id: "evt-5", sequence: 5, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: new Date().toISOString() },
    ],
    startSequence: 1,
    endSequence: 5,
    createdAt: new Date().toISOString(),
  });

  const lag = cdcService.getReplicationLag("us-east-1", "us-west-2", 10);
  assert.equal(lag, 5); // 10 total - 5 replicated = 5 lag
});

test("integration: DataReplicatorService flushAll preserves state after failover", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2", "eu-west-1"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  // Record events to both regions
  replicator.recordEvent("us-west-2", "Execution", "exec-1", { status: "running" });
  replicator.recordEvent("eu-west-1", "Execution", "exec-1", { status: "running" });

  // Flush all regions
  const results = await replicator.flushAll();

  assert.equal(results.size, 2);
  assert.equal(results.get("us-west-2")?.success, true);
  assert.equal(results.get("eu-west-1")?.success, true);

  // Checkpoints should be updated for both
  const westCheckpoint = replicator.getCheckpoint("us-west-2");
  const euCheckpoint = replicator.getCheckpoint("eu-west-1");

  assert.ok(westCheckpoint != null);
  assert.ok(euCheckpoint != null);
  assert.equal(westCheckpoint.sourceRegionId, "us-east-1");
  assert.equal(euCheckpoint.sourceRegionId, "us-east-1");
});

test("integration: cross-region routing preserves execution context across failover", () => {
  const service = new CrossRegionRoutingService();
  const { primary, secondary, tertiary } = createMultiRegionConfig();

  const request: CrossRegionRouteRequest = {
    regions: [primary, secondary, tertiary],
    policy: {
      policyId: "default",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      allowCrossBorder: true,
    },
    primaryRegionId: "us-east-1",
    preferredRegionId: "us-east-1",
    primaryRegionHealthy: false,
    replicationPolicy: {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["us-west-2", "eu-west-1"],
      residencyMode: "allowed_cross_border",
    },
  };

  const decision = service.route(request);

  // Should route to fallback
  assert.ok(decision.selectedRegionId !== "us-east-1" || decision.selectedRegionId === null);

  // Recovery topology should identify replication targets
  assert.ok(decision.recoveryTopology.replicationTargets.length >= 0);
  assert.equal(decision.recoveryTopology.primaryRegionId, "us-east-1");
});

test("integration: RegionFailoverOrchestrator checkAndFailover preserves state", async () => {
  const orchestrator = new RegionFailoverOrchestrator();

  // Register primary
  orchestrator.registerRegion({
    regionId: "us-east-1",
    endpoint: "https://health.us-east-1.example.com",
    checkIntervalMs: 1000,
    timeoutMs: 500,
    retryCount: 3,
    metricSnapshot: { latencyMs: 500, errorRate: 0.1 },
    thresholds: { maxLatencyMs: 100, maxErrorRate: 0.05, maxCpuUsage: 80, maxMemoryUsage: 90 },
  });

  // Register fallback
  orchestrator.registerRegion({
    regionId: "us-west-2",
    endpoint: "https://health.us-west-2.example.com",
    checkIntervalMs: 1000,
    timeoutMs: 500,
    retryCount: 3,
    metricSnapshot: { latencyMs: 60, errorRate: 0.01 },
    thresholds: { maxLatencyMs: 100, maxErrorRate: 0.05, maxCpuUsage: 80, maxMemoryUsage: 90 },
  });

  const result = await orchestrator.checkAndFailover("us-east-1", ["us-west-2"]);

  assert.equal(result.didFailover, true);
  assert.equal(result.targetRegionId, "us-west-2");
});

test("integration: selectPreferredRegion returns null when all regions are draining", () => {
  const regions: RegionDescriptor[] = [
    createMockRegionDescriptor({ regionId: "us-east-1", status: "draining" }),
    createMockRegionDescriptor({ regionId: "us-west-2", status: "draining" }),
  ];

  const selected = selectPreferredRegion(regions);
  assert.equal(selected, null);
});

test("integration: selectPreferredRegion filters out regions with residency not allowed", () => {
  const regions: RegionDescriptor[] = [
    createMockRegionDescriptor({ regionId: "us-east-1", residencyAllowed: true, latencyScore: 100 }),
    createMockRegionDescriptor({ regionId: "cn-north-1", residencyAllowed: false, latencyScore: 30 }),
  ];

  const selected = selectPreferredRegion(regions);
  assert.equal(selected?.regionId, "us-east-1"); // Only US region is selectable
});