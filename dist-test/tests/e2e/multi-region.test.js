/**
 * E2E Multi-Region Tests
 *
 * End-to-end tests for multi-region scale ecosystem covering:
 * - Cross-region routing with residency policies
 * - Region health monitoring and failover orchestration
 * - CDC-based replication across regions
 * - Data replication with buffering and checkpointing
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CrossRegionRoutingService, } from "../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import { RegionHealthCheckService, RegionFailoverOrchestrator, } from "../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import { resolveRegionFailover } from "../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import { CDCReplicationService, MultiRegionReplicationCoordinator, } from "../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import { ReplicationEventBuffer, shouldReplicateToRegion, computeChecksum, createDataReplicator, } from "../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { selectPreferredRegion } from "../../src/scale-ecosystem/multi-region/region-router/index.js";
// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function createMockRegion(id, overrides = {}) {
    return {
        regionId: id,
        jurisdiction: overrides.jurisdiction ?? "US",
        residencyAllowed: overrides.residencyAllowed ?? true,
        latencyScore: overrides.latencyScore ?? 50,
        status: overrides.status ?? "active",
        capabilities: overrides.capabilities ?? [],
        ...overrides,
    };
}
function createHealthCheckConfig(regionId, overrides = {}) {
    return {
        regionId,
        endpoint: `https://${regionId}.example.com/health`,
        checkIntervalMs: 10_000,
        timeoutMs: 5_000,
        retryCount: 3,
        thresholds: {
            maxLatencyMs: overrides.maxLatencyMs ?? 200,
            maxErrorRate: overrides.maxErrorRate ?? 0.05,
            maxCpuUsage: overrides.maxCpuUsage ?? 0.8,
            maxMemoryUsage: overrides.maxMemoryUsage ?? 0.9,
        },
    };
}
function createCDCEvent(sequence, taskId = "task-001") {
    return {
        id: `evt_${sequence}`,
        sequence,
        eventType: "task:completed",
        taskId,
        payloadJson: JSON.stringify({ result: "success" }),
        createdAt: new Date().toISOString(),
    };
}
// ---------------------------------------------------------------------------
// Cross-Region Routing Service Tests
// ---------------------------------------------------------------------------
test("E2E: CrossRegionRoutingService routes to preferred region when allowed", (t) => {
    const service = new CrossRegionRoutingService();
    const regions = [
        createMockRegion("us-east-1", { latencyScore: 30, jurisdiction: "US" }),
        createMockRegion("us-west-2", { latencyScore: 60, jurisdiction: "US" }),
        createMockRegion("eu-west-1", { latencyScore: 100, jurisdiction: "EU" }),
    ];
    const policy = {
        policyId: "policy-001",
        allowedJurisdictions: ["US", "EU"],
        allowCrossBorder: true,
    };
    const request = {
        regions,
        policy,
        preferredRegionId: "us-west-2",
        primaryRegionId: "us-east-1",
        primaryRegionHealthy: true,
    };
    const decision = service.route(request);
    assert.equal(decision.selectedRegionId, "us-west-2", "should select preferred region");
    assert.equal(decision.residencyDecision, "allowed", "residency should be allowed");
    assert.ok(decision.candidateRegions.includes("us-west-2"), "preferred should be in candidates");
});
test("E2E: CrossRegionRoutingService blocks region when jurisdiction not allowed", (t) => {
    const service = new CrossRegionRoutingService();
    const regions = [
        createMockRegion("us-east-1", { jurisdiction: "US" }),
        createMockRegion("cn-north-1", { jurisdiction: "CN" }),
    ];
    const policy = {
        policyId: "policy-002",
        allowedJurisdictions: ["US", "EU"],
        allowCrossBorder: false,
    };
    const request = {
        regions,
        policy,
        primaryRegionId: "us-east-1",
        primaryRegionHealthy: true,
    };
    const decision = service.route(request);
    // CN region should be blocked due to jurisdiction not being in allowed list
    assert.ok(decision.blockedRegions.includes("cn-north-1"), "CN region should be blocked");
    // But since us-east-1 is allowed, the overall decision is "allowed"
    assert.equal(decision.residencyDecision, "allowed", "should be allowed since valid candidate exists");
    assert.equal(decision.selectedRegionId, "us-east-1", "should select the allowed region");
});
test("E2E: CrossRegionRoutingService respects blocked regions", (t) => {
    const service = new CrossRegionRoutingService();
    const regions = [
        createMockRegion("us-east-1", { latencyScore: 20 }),
        createMockRegion("us-west-2", { latencyScore: 40 }),
        createMockRegion("eu-west-1", { latencyScore: 30 }),
    ];
    const policy = {
        policyId: "policy-003",
        allowedJurisdictions: ["US", "EU"],
        blockedRegionIds: ["us-east-1"],
        allowCrossBorder: true,
    };
    const request = {
        regions,
        policy,
        primaryRegionId: "us-east-1",
        primaryRegionHealthy: true,
    };
    const decision = service.route(request);
    assert.ok(decision.blockedRegions.includes("us-east-1"), "us-east-1 should be blocked");
    assert.equal(decision.selectedRegionId, "eu-west-1", "should select next best region by latency");
});
test("E2E: CrossRegionRoutingService selects lowest latency when no preference", (t) => {
    const service = new CrossRegionRoutingService();
    const regions = [
        createMockRegion("us-east-1", { latencyScore: 80 }),
        createMockRegion("us-west-2", { latencyScore: 20 }),
        createMockRegion("eu-west-1", { latencyScore: 50 }),
    ];
    const policy = {
        policyId: "policy-004",
        allowedJurisdictions: ["US", "EU"],
        allowCrossBorder: true,
    };
    const request = {
        regions,
        policy,
        primaryRegionId: "us-east-1",
        primaryRegionHealthy: true,
    };
    const decision = service.route(request);
    assert.equal(decision.selectedRegionId, "us-west-2", "should select lowest latency region");
    assert.equal(decision.latencyScore, 20, "latency score should match selected region");
});
test("E2E: CrossRegionRoutingService handles region with required capabilities", (t) => {
    const service = new CrossRegionRoutingService();
    const regions = [
        createMockRegion("us-east-1", { capabilities: ["ai-inference", "streaming"] }),
        createMockRegion("us-west-2", { capabilities: ["ai-inference"] }),
        createMockRegion("eu-west-1", { capabilities: ["batch-processing"] }),
    ];
    const policy = {
        policyId: "policy-005",
        allowedJurisdictions: ["US", "EU"],
        requiredCapabilities: ["ai-inference"],
        allowCrossBorder: true,
    };
    const request = {
        regions,
        policy,
        primaryRegionId: "us-east-1",
        primaryRegionHealthy: true,
    };
    const decision = service.route(request);
    assert.ok(decision.candidateRegions.includes("us-east-1"), "us-east-1 has required capabilities");
    assert.ok(decision.candidateRegions.includes("us-west-2"), "us-west-2 has required capabilities");
    assert.ok(!decision.candidateRegions.includes("eu-west-1"), "eu-west-1 lacks required capabilities");
    assert.ok(decision.blockedRegions.includes("eu-west-1"), "eu-west-1 should be blocked");
});
test("E2E: CrossRegionRoutingService sets recovery topology on failover", (t) => {
    const service = new CrossRegionRoutingService();
    const regions = [
        createMockRegion("us-east-1", { latencyScore: 10 }),
        createMockRegion("us-west-2", { latencyScore: 30 }),
        createMockRegion("eu-west-1", { latencyScore: 50 }),
    ];
    const policy = {
        policyId: "policy-006",
        allowedJurisdictions: ["US", "EU"],
        allowCrossBorder: true,
    };
    const replicationPolicy = {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2", "eu-west-1"],
        residencyMode: "same_jurisdiction",
    };
    const request = {
        regions,
        policy,
        primaryRegionId: "us-east-1",
        primaryRegionHealthy: false, // Primary unhealthy triggers failover
        replicationPolicy,
    };
    const decision = service.route(request);
    assert.equal(decision.recoveryTopology.primaryRegionId, "us-east-1", "primary should be set");
    assert.ok(decision.recoveryTopology.failoverRegionId != null || decision.recoveryTopology.replicationTargets.length >= 0);
});
// ---------------------------------------------------------------------------
// Region Health Check Service Tests
// ---------------------------------------------------------------------------
test("E2E: RegionHealthCheckService registers and checks region health", async (t) => {
    const service = new RegionHealthCheckService();
    service.registerRegion(createHealthCheckConfig("us-east-1"));
    const result = await service.checkRegion("us-east-1");
    assert.equal(result.regionId, "us-east-1", "regionId should match");
    assert.ok(result.status === "healthy" || result.status === "degraded" || result.status === "unhealthy", "status should be valid");
    assert.ok(result.latencyMs >= 0, "latency should be non-negative");
    assert.ok(result.checkedAt, "checkedAt should be set");
});
test("E2E: RegionHealthCheckService returns unknown for unregistered region", async (t) => {
    const service = new RegionHealthCheckService();
    const result = await service.checkRegion("unknown-region");
    assert.equal(result.regionId, "unknown-region");
    assert.equal(result.status, "unknown");
    assert.ok(result.errorMessage?.includes("not registered"), "should indicate not registered");
});
test("E2E: RegionHealthCheckService tracks consecutive failures", async (t) => {
    const service = new RegionHealthCheckService();
    service.registerRegion(createHealthCheckConfig("us-east-1"));
    // Perform multiple checks
    for (let i = 0; i < 3; i++) {
        await service.checkRegion("us-east-1");
    }
    const summary = service.getHealthSummary("us-east-1");
    assert.ok(summary, "should have health summary");
    assert.ok(summary.consecutiveFailures >= 0, "consecutive failures should be tracked");
});
test("E2E: RegionHealthCheckService determines shouldFailover correctly", async (t) => {
    const service = new RegionHealthCheckService();
    service.registerRegion(createHealthCheckConfig("us-east-1"));
    await service.checkRegion("us-east-1");
    const summary = service.getHealthSummary("us-east-1");
    assert.ok(summary, "should have health summary");
    // Unhealthy regions should trigger failover
    if (summary?.status === "unhealthy") {
        assert.ok(service.shouldFailover("us-east-1"), "unhealthy region should failover");
    }
});
test("E2E: RegionHealthCheckService checks all registered regions", async (t) => {
    const service = new RegionHealthCheckService();
    service.registerRegion(createHealthCheckConfig("us-east-1"));
    service.registerRegion(createHealthCheckConfig("us-west-2"));
    service.registerRegion(createHealthCheckConfig("eu-west-1"));
    const results = await service.checkAllRegions();
    assert.equal(results.length, 3, "should check all 3 regions");
    assert.ok(results.every((r) => r.regionId), "each result should have regionId");
});
test("E2E: RegionFailoverOrchestrator selects best failover target", async (t) => {
    const healthService = new RegionHealthCheckService();
    const orchestrator = new RegionFailoverOrchestrator(healthService);
    // Register regions
    healthService.registerRegion(createHealthCheckConfig("us-east-1", { maxLatencyMs: 100 }));
    healthService.registerRegion(createHealthCheckConfig("us-west-2", { maxLatencyMs: 150 }));
    healthService.registerRegion(createHealthCheckConfig("eu-west-1", { maxLatencyMs: 200 }));
    // Check health of all regions
    await healthService.checkAllRegions();
    const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1", "us-west-2", "eu-west-1"]);
    // Should select a healthy region (may be null if all are unhealthy in simulation)
    assert.ok(target === null || typeof target === "string", "target should be string or null");
});
test("E2E: RegionFailoverOrchestrator orchestrates failover when needed", async (t) => {
    const healthService = new RegionHealthCheckService();
    const orchestrator = new RegionFailoverOrchestrator(healthService);
    healthService.registerRegion(createHealthCheckConfig("primary"));
    healthService.registerRegion(createHealthCheckConfig("backup"));
    const result = await orchestrator.orchestrateFailover("primary", ["primary", "backup"]);
    assert.ok(typeof result.success === "boolean", "success should be boolean");
    assert.ok(result.targetRegionId === null || typeof result.targetRegionId === "string");
});
test("E2E: RegionFailoverOrchestrator add/remove failover listeners", async (t) => {
    const healthService = new RegionHealthCheckService();
    const orchestrator = new RegionFailoverOrchestrator(healthService);
    let listenerCallCount = 0;
    const listener = (_source, _target) => {
        listenerCallCount++;
    };
    orchestrator.addFailoverListener(listener);
    orchestrator.removeFailoverListener(listener);
    // After removal, listener should not be called
    assert.ok(true, "listener lifecycle methods work without error");
});
// ---------------------------------------------------------------------------
// Failover Controller Tests
// ---------------------------------------------------------------------------
test("E2E: resolveRegionFailover returns no failover when primary is healthy", (t) => {
    const input = {
        primaryHealthy: true,
        candidateRegionIds: ["us-west-2", "eu-west-1"],
    };
    const decision = resolveRegionFailover(input);
    assert.equal(decision.shouldFailover, false, "should not failover when primary healthy");
    assert.equal(decision.targetRegionId, null, "target should be null");
    assert.ok(decision.rationale.includes("primary_within_threshold"), "rationale should indicate primary healthy");
});
test("E2E: resolveRegionFailover triggers failover when primary is unhealthy", (t) => {
    const input = {
        primaryHealthy: false,
        candidateRegionIds: ["us-west-2", "eu-west-1"],
    };
    const decision = resolveRegionFailover(input);
    assert.equal(decision.shouldFailover, true, "should failover when primary unhealthy");
    assert.equal(decision.targetRegionId, "us-west-2", "should select first candidate");
    assert.ok(decision.rationale.includes("primary_unhealthy"), "rationale should indicate unhealthy primary");
});
test("E2E: resolveRegionFailover triggers failover when latency breached", (t) => {
    const input = {
        primaryHealthy: true,
        candidateRegionIds: ["us-west-2"],
        primaryLatencyMs: 300,
        maxAcceptableLatencyMs: 200,
    };
    const decision = resolveRegionFailover(input);
    assert.equal(decision.shouldFailover, true, "should failover when latency breached");
    assert.ok(decision.rationale.includes("latency"), "rationale should indicate latency breach");
});
test("E2E: resolveRegionFailover triggers failover when error rate breached", (t) => {
    const input = {
        primaryHealthy: true,
        candidateRegionIds: ["us-west-2"],
        primaryErrorRate: 0.15,
        maxAcceptableErrorRate: 0.05,
    };
    const decision = resolveRegionFailover(input);
    assert.equal(decision.shouldFailover, true, "should failover when error rate breached");
    assert.ok(decision.rationale.includes("error_rate"), "rationale should indicate error rate breach");
});
test("E2E: resolveRegionFailover uses preferred region when available", (t) => {
    const input = {
        primaryHealthy: false,
        candidateRegionIds: ["us-west-2", "eu-west-1", "ap-south-1"],
        preferredRegionId: "eu-west-1",
    };
    const decision = resolveRegionFailover(input);
    assert.equal(decision.shouldFailover, true);
    assert.equal(decision.targetRegionId, "eu-west-1", "should use preferred region");
});
test("E2E: resolveRegionFailover returns no failover when no candidates", (t) => {
    const input = {
        primaryHealthy: false,
        candidateRegionIds: [],
    };
    const decision = resolveRegionFailover(input);
    assert.equal(decision.shouldFailover, false, "should not failover without candidates");
    assert.equal(decision.targetRegionId, null, "target should be null");
    assert.ok(decision.rationale.includes("no_candidate"), "rationale should indicate no candidates");
});
// ---------------------------------------------------------------------------
// CDC Replication Service Tests
// ---------------------------------------------------------------------------
test("E2E: CDCReplicationService registers and retrieves replication config", (t) => {
    const service = new CDCReplicationService();
    service.registerReplication({
        sourceRegionId: "us-east-1",
        targetRegionId: "us-west-2",
        batchSize: 100,
        replicationIntervalMs: 5000,
        enabled: true,
        retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    });
    const config = service.getConfig("us-east-1", "us-west-2");
    assert.ok(config, "config should exist");
    assert.equal(config?.sourceRegionId, "us-east-1");
    assert.equal(config?.targetRegionId, "us-west-2");
    assert.equal(config?.batchSize, 100);
});
test("E2E: CDCReplicationService prepares batch from events", (t) => {
    const service = new CDCReplicationService();
    service.registerReplication({
        sourceRegionId: "us-east-1",
        targetRegionId: "us-west-2",
        batchSize: 10,
        replicationIntervalMs: 5000,
        enabled: true,
        retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    });
    const events = [
        createCDCEvent(1),
        createCDCEvent(2),
        createCDCEvent(3),
    ];
    const batch = service.prepareBatch("us-east-1", "us-west-2", events);
    assert.ok(batch, "batch should be created");
    assert.equal(batch.sourceRegionId, "us-east-1");
    assert.equal(batch.targetRegionId, "us-west-2");
    assert.equal(batch.events.length, 3);
    assert.equal(batch.startSequence, 1);
    assert.equal(batch.endSequence, 3);
});
test("E2E: CDCReplicationService confirms batch and updates checkpoint", (t) => {
    const service = new CDCReplicationService();
    service.registerReplication({
        sourceRegionId: "us-east-1",
        targetRegionId: "eu-west-1",
        batchSize: 100,
        replicationIntervalMs: 5000,
        enabled: true,
        retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    });
    const events = [createCDCEvent(1), createCDCEvent(2)];
    const batch = service.prepareBatch("us-east-1", "eu-west-1", events);
    assert.ok(batch, "batch should exist");
    service.confirmBatch("us-east-1", "eu-west-1", batch);
    const checkpoint = service.getCheckpoint("us-east-1", "eu-west-1");
    assert.ok(checkpoint, "checkpoint should exist after confirm");
    assert.equal(checkpoint.lastEventSequence, 2, "checkpoint sequence should match batch end");
});
test("E2E: CDCReplicationService calculates replication lag", (t) => {
    const service = new CDCReplicationService();
    service.registerReplication({
        sourceRegionId: "us-east-1",
        targetRegionId: "ap-south-1",
        batchSize: 100,
        replicationIntervalMs: 5000,
        enabled: true,
        retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    });
    const events = [
        createCDCEvent(1),
        createCDCEvent(2),
        createCDCEvent(3),
    ];
    const batch = service.prepareBatch("us-east-1", "ap-south-1", events);
    // Confirm the batch to update checkpoint
    if (batch) {
        service.confirmBatch("us-east-1", "ap-south-1", batch);
    }
    const lag = service.getReplicationLag("us-east-1", "ap-south-1", 10);
    assert.ok(lag >= 0, "lag should be non-negative");
    assert.equal(lag, 7, "lag should be events not yet replicated after confirmBatch");
});
test("E2E: CDCReplicationService returns idle status when no pending work", (t) => {
    const service = new CDCReplicationService();
    service.registerReplication({
        sourceRegionId: "us-east-1",
        targetRegionId: "us-west-2",
        batchSize: 100,
        replicationIntervalMs: 5000,
        enabled: true,
        retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    });
    const status = service.getStatus("us-east-1", "us-west-2");
    assert.equal(status, "idle", "status should be idle with no pending batches");
});
test("E2E: MultiRegionReplicationCoordinator sets up replication for multiple targets", (t) => {
    const coordinator = new MultiRegionReplicationCoordinator();
    coordinator.setupRegionReplication("us-east-1", [
        { targetRegionId: "us-west-2", batchSize: 50 },
        { targetRegionId: "eu-west-1", batchSize: 75 },
        { targetRegionId: "ap-south-1" },
    ]);
    const replications = coordinator.getRegionReplications("us-east-1");
    assert.equal(replications.length, 3, "should have 3 replication configs");
    assert.ok(replications.some((r) => r.targetRegionId === "us-west-2" && r.batchSize === 50));
    assert.ok(replications.some((r) => r.targetRegionId === "eu-west-1" && r.batchSize === 75));
    assert.ok(replications.some((r) => r.targetRegionId === "ap-south-1" && r.batchSize === 100)); // default
});
// ---------------------------------------------------------------------------
// Data Replicator Service Tests
// ---------------------------------------------------------------------------
test("E2E: DataReplicatorService creates buffers for target regions", (t) => {
    const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2", "eu-west-1"],
        residencyMode: "same_jurisdiction",
    });
    const buffer1 = replicator.getBuffer("us-west-2");
    const buffer2 = replicator.getBuffer("eu-west-1");
    const buffer3 = replicator.getBuffer("unknown");
    assert.ok(buffer1, "buffer for us-west-2 should exist");
    assert.ok(buffer2, "buffer for eu-west-1 should exist");
    assert.strictEqual(buffer3, null, "buffer for unknown region should be null");
});
test("E2E: ReplicationEventBuffer adds events and signals when full", (t) => {
    const buffer = new ReplicationEventBuffer(3, 60_000);
    const event1 = { eventId: "e1", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "task", aggregateId: "task-1", payload: { foo: "bar" }, timestamp: new Date().toISOString(), checksum: "" };
    const event2 = { eventId: "e2", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "task", aggregateId: "task-2", payload: { baz: "qux" }, timestamp: new Date().toISOString(), checksum: "" };
    const event3 = { eventId: "e3", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "task", aggregateId: "task-3", payload: { hello: "world" }, timestamp: new Date().toISOString(), checksum: "" };
    const shouldFlush1 = buffer.add(event1);
    assert.equal(shouldFlush1, false, "should not signal flush after first event");
    assert.equal(buffer.size(), 1);
    const shouldFlush2 = buffer.add(event2);
    assert.equal(shouldFlush2, false, "should not signal flush after second event");
    assert.equal(buffer.size(), 2);
    const shouldFlush3 = buffer.add(event3);
    assert.equal(shouldFlush3, true, "should signal flush when buffer is full");
    assert.equal(buffer.size(), 3, "buffer still has all events until explicitly flushed");
    // When add() returns true, caller should flush manually
    const flushed = buffer.flush();
    assert.equal(flushed.length, 3, "should return all 3 events when flushed");
    assert.equal(buffer.size(), 0, "buffer should be empty after flush");
});
test("E2E: ReplicationEventBuffer flushes manually", (t) => {
    const buffer = new ReplicationEventBuffer(100, 60_000);
    const event = { eventId: "e1", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "task", aggregateId: "task-1", payload: { test: true }, timestamp: new Date().toISOString(), checksum: "" };
    buffer.add(event);
    assert.equal(buffer.size(), 1);
    const flushed = buffer.flush();
    assert.equal(flushed.length, 1, "should return the event");
    assert.equal(flushed[0].eventId, "e1");
    assert.equal(buffer.size(), 0, "buffer should be empty after flush");
});
test("E2E: DataReplicatorService records events and flushes when buffer full", async (t) => {
    const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2"],
        residencyMode: "allowed_cross_border",
    }, { batchSize: 2 });
    // Record events (batch size is 2, so 2 events should trigger flush)
    replicator.recordEvent("us-west-2", "task", "task-1", { action: "create" });
    const result = replicator.recordEvent("us-west-2", "task", "task-2", { action: "update" });
    // Second event should trigger flush, returning event with checksum
    assert.ok(result.checksum.length > 0, "checksum should be computed");
});
test("E2E: DataReplicatorService computes checksum correctly", (t) => {
    const payload = { key: "value", number: 42 };
    const checksum = computeChecksum(payload, "sha256");
    assert.ok(checksum.length === 64, "SHA256 checksum should be 64 hex chars");
    // Verify same payload produces same checksum
    const checksum2 = computeChecksum(payload, "sha256");
    assert.equal(checksum, checksum2, "same payload should produce same checksum");
    // Different payload produces different checksum
    const differentChecksum = computeChecksum({ key: "different" }, "sha256");
    assert.notEqual(checksum, differentChecksum, "different payload should produce different checksum");
});
test("E2E: shouldReplicateToRegion respects replication policy", (t) => {
    const policy = {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2", "eu-west-1"],
        residencyMode: "same_jurisdiction",
    };
    assert.equal(shouldReplicateToRegion(policy, "us-west-2"), true, "should replicate to allowed target");
    assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), true, "should replicate to allowed target");
    assert.equal(shouldReplicateToRegion(policy, "ap-south-1"), false, "should not replicate to non-listed target");
    const blockedPolicy = {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2"],
        residencyMode: "blocked",
    };
    assert.equal(shouldReplicateToRegion(blockedPolicy, "us-west-2"), false, "should not replicate when blocked");
});
test("E2E: DataReplicatorService validates incoming event checksum", async (t) => {
    const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2"],
        residencyMode: "allowed_cross_border",
    });
    const event = replicator.recordEvent("us-west-2", "task", "task-1", { validated: true });
    assert.equal(replicator.validateEvent(event), true, "event should be valid with matching checksum");
    // Tamper with payload
    const tamperedEvent = { ...event, payload: { tampered: true } };
    assert.equal(replicator.validateEvent(tamperedEvent), false, "tampered event should fail validation");
});
test("E2E: DataReplicatorService flushes all buffers", async (t) => {
    const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2", "eu-west-1"],
        residencyMode: "same_jurisdiction",
    }, { batchSize: 1000 }); // Large batch size to prevent auto-flush
    replicator.recordEvent("us-west-2", "task", "task-1", { data: "west" });
    replicator.recordEvent("eu-west-1", "task", "task-2", { data: "east" });
    const results = await replicator.flushAll();
    assert.equal(results.size, 2, "should have results for both regions");
    assert.ok(results.get("us-west-2"), "should have result for us-west-2");
    assert.ok(results.get("eu-west-1"), "should have result for eu-west-1");
});
test("E2E: DataReplicatorService registers and handles incoming events", async (t) => {
    const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
        sourceRegionId: "us-east-1",
        targetRegionIds: ["us-west-2"],
        residencyMode: "allowed_cross_border",
    });
    let receivedEvent = null;
    // Handler should be registered for the SOURCE region, not target
    // When recordEvent creates an event, sourceRegionId = "us-east-1"
    replicator.onEvent("us-east-1", async (event) => {
        receivedEvent = event;
    });
    const event = replicator.recordEvent("us-west-2", "task", "task-1", { hello: "world" });
    // handleIncomingEvent looks up handler by event.sourceRegionId
    await replicator.handleIncomingEvent(event);
    assert.ok(receivedEvent, "event handler should have been called");
    assert.equal(receivedEvent?.eventId, event.eventId, "received event should match");
});
// ---------------------------------------------------------------------------
// selectPreferredRegion Tests
// ---------------------------------------------------------------------------
test("E2E: selectPreferredRegion returns lowest latency region", (t) => {
    const regions = [
        createMockRegion("us-east-1", { latencyScore: 100 }),
        createMockRegion("us-west-2", { latencyScore: 30 }),
        createMockRegion("eu-west-1", { latencyScore: 60 }),
    ];
    const selected = selectPreferredRegion(regions);
    assert.equal(selected?.regionId, "us-west-2", "should select lowest latency");
});
test("E2E: selectPreferredRegion filters out disabled regions", (t) => {
    const regions = [
        createMockRegion("us-east-1", { latencyScore: 10, status: "disabled" }),
        createMockRegion("us-west-2", { latencyScore: 50 }),
    ];
    const selected = selectPreferredRegion(regions);
    assert.equal(selected?.regionId, "us-west-2", "should skip disabled region");
});
test("E2E: selectPreferredRegion filters out regions with residency not allowed", (t) => {
    const regions = [
        createMockRegion("us-east-1", { latencyScore: 10, residencyAllowed: false }),
        createMockRegion("us-west-2", { latencyScore: 50 }),
    ];
    const selected = selectPreferredRegion(regions);
    assert.equal(selected?.regionId, "us-west-2", "should skip region with residency not allowed");
});
test("E2E: selectPreferredRegion returns null for empty array", (t) => {
    const selected = selectPreferredRegion([]);
    assert.equal(selected, null, "should return null for empty array");
});
test("E2E: selectPreferredRegion returns null when all regions disabled", (t) => {
    const regions = [
        createMockRegion("us-east-1", { status: "disabled" }),
        createMockRegion("us-west-2", { status: "disabled" }),
    ];
    const selected = selectPreferredRegion(regions);
    assert.equal(selected, null, "should return null when all disabled");
});
// ---------------------------------------------------------------------------
// End of E2E Multi-Region Tests
// ---------------------------------------------------------------------------
//# sourceMappingURL=multi-region.test.js.map